// Header-only DLL fixture, never executed. Real-agent tests use Workshop binaries.
function dll() {
  const bytes = Buffer.alloc(512);
  bytes.write('MZ'); bytes.writeUInt32LE(128, 60); bytes.writeUInt32LE(0x4550, 128);
  bytes.writeUInt16LE(0x8664, 132); bytes.writeUInt16LE(0x2000, 150);
  return bytes;
}
module.exports = { dll };
