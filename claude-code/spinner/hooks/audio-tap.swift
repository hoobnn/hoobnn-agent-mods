// spinner's `audio` theme: taps the Mac's system output (a Core Audio process
// tap, macOS 14.2+) and prints one line per 50 ms, `L <loudness> <b0> <b1> ...`,
// each 0..99, bands log-spaced from 40 Hz to 16 kHz. Nothing is kept or sent:
// only these numbers leave, on stdout. Exits when stdout closes or on a signal.
// Built on first use by register.tsx: swiftc -O audio-tap.swift -o audio-tap
import Accelerate
import AudioToolbox
import CoreAudio
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)
signal(SIGPIPE, SIG_IGN)

let bandCount = max(4, min(64, Int(CommandLine.arguments.dropFirst().first ?? "") ?? 32))
let fftSize = 1024
let log2n = vDSP_Length(10)

func fail(_ what: String, _ status: OSStatus) -> Never {
  FileHandle.standardError.write("E \(what) \(status)\n".data(using: .utf8)!)
  print("E \(what)")
  exit(1)
}

func getProp<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ value: inout T) -> OSStatus {
  var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var size = UInt32(MemoryLayout<T>.size)
  return AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value)
}

// A global stereo tap over every process, and a private aggregate device to read it.
let tap = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
tap.uuid = UUID()
tap.isPrivate = true
tap.muteBehavior = .unmuted
var tapID = AudioObjectID(kAudioObjectUnknown)
var status = AudioHardwareCreateProcessTap(tap, &tapID)
if status != noErr { fail("tap", status) }

var outputID = AudioObjectID(kAudioObjectUnknown)
status = getProp(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultSystemOutputDevice, &outputID)
if status != noErr { fail("output", status) }
var outputUID: CFString = "" as CFString
status = getProp(outputID, kAudioDevicePropertyDeviceUID, &outputUID)
if status != noErr { fail("uid", status) }

let aggregate: [String: Any] = [
  kAudioAggregateDeviceNameKey: "spinner-audio-tap",
  kAudioAggregateDeviceUIDKey: UUID().uuidString,
  kAudioAggregateDeviceMainSubDeviceKey: outputUID as String,
  kAudioAggregateDeviceIsPrivateKey: true,
  kAudioAggregateDeviceIsStackedKey: false,
  kAudioAggregateDeviceTapAutoStartKey: true,
  kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID as String]],
  kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: tap.uuid.uuidString]],
]
var deviceID = AudioObjectID(kAudioObjectUnknown)
status = AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &deviceID)
if status != noErr { fail("aggregate", status) }

var format = AudioStreamBasicDescription()
status = getProp(tapID, kAudioTapPropertyFormat, &format)
if status != noErr { fail("format", status) }
let sampleRate = format.mSampleRate > 0 ? format.mSampleRate : 48000

func cleanup() {
  AudioHardwareDestroyAggregateDevice(deviceID)
  AudioHardwareDestroyProcessTap(tapID)
}
for sig in [SIGINT, SIGTERM, SIGHUP] {
  signal(sig) { _ in
    AudioHardwareDestroyAggregateDevice(deviceID)
    AudioHardwareDestroyProcessTap(tapID)
    exit(0)
  }
}

// Mono samples gathered by the IO callback, read by the printer on the main queue.
let lock = NSLock()
var ring = [Float](repeating: 0, count: fftSize)
var ringPos = 0

var procID: AudioDeviceIOProcID?
status = AudioDeviceCreateIOProcIDWithBlock(&procID, deviceID, nil) { _, input, _, _, _ in
  let list = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
  guard let first = list.first, let data = first.mData else { return }
  let channels = max(1, Int(first.mNumberChannels))
  let frames = Int(first.mDataByteSize) / (MemoryLayout<Float>.size * channels)
  let samples = data.assumingMemoryBound(to: Float.self)
  let second = list.count > 1 ? list[1].mData?.assumingMemoryBound(to: Float.self) : nil
  lock.lock()
  for i in 0..<frames {
    var v = samples[i * channels]
    if channels > 1 { v = (v + samples[i * channels + 1]) * 0.5 } else if let s = second { v = (v + s[i]) * 0.5 }
    ring[ringPos] = v
    ringPos = (ringPos + 1) % fftSize
  }
  lock.unlock()
}
if status != noErr { fail("ioproc", status) }
status = AudioDeviceStart(deviceID, procID)
if status != noErr { fail("start", status) }

// Log-spaced bands from 40 Hz to 16 kHz over a Hann-windowed FFT.
let fft = vDSP.FFT(log2n: log2n, radix: .radix2, ofType: DSPSplitComplex.self)!
let window = vDSP.window(ofType: Float.self, usingSequence: .hanningDenormalized, count: fftSize, isHalfWindow: false)
let binHz = sampleRate / Double(fftSize)
let edges: [Int] = (0...bandCount).map { i in
  let hz = 40 * pow(16000.0 / 40, Double(i) / Double(bandCount))
  return max(1, min(fftSize / 2 - 1, Int(hz / binHz)))
}
var smooth = [Float](repeating: 0, count: bandCount)
var real = [Float](repeating: 0, count: fftSize / 2)
var imag = [Float](repeating: 0, count: fftSize / 2)

let timer = DispatchSource.makeTimerSource(queue: .main)
timer.schedule(deadline: .now(), repeating: .milliseconds(50))
timer.setEventHandler {
  lock.lock()
  let frame = Array(ring[ringPos...] + ring[..<ringPos])
  lock.unlock()
  let windowed = vDSP.multiply(frame, window)
  let rms = vDSP.rootMeanSquare(frame)
  var mags = [Float](repeating: 0, count: fftSize / 2)
  real.withUnsafeMutableBufferPointer { r in
    imag.withUnsafeMutableBufferPointer { im in
      var split = DSPSplitComplex(realp: r.baseAddress!, imagp: im.baseAddress!)
      windowed.withUnsafeBufferPointer { w in
        w.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) {
          vDSP_ctoz($0, 2, &split, 1, vDSP_Length(fftSize / 2))
        }
      }
      fft.forward(input: split, output: &split)
      vDSP.absolute(split, result: &mags)
    }
  }
  var out = [String]()
  for b in 0..<bandCount {
    let lo = edges[b], hi = max(edges[b] + 1, edges[b + 1])
    let peak = mags[lo..<hi].max() ?? 0
    // Magnitude to dB, mapped from -60..0 dBFS-ish onto 0..1.
    let db = 20 * log10(max(peak / Float(fftSize / 4), 1e-6))
    let v = max(0, min(1, (db + 60) / 60))
    smooth[b] = v > smooth[b] ? v : smooth[b] * 0.82 + v * 0.18
    out.append(String(Int(smooth[b] * 99)))
  }
  let loud = max(0, min(1, (20 * log10(max(rms, 1e-6)) + 50) / 50))
  if fputs("L \(Int(loud * 99)) \(out.joined(separator: " "))\n", stdout) < 0 { cleanup(); exit(0) }
}
timer.resume()
dispatchMain()
