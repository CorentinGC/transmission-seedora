import { describe, expect, it } from 'vitest';
import { BAD_PORTS, classifyAddress, isAddressAllowed, isPortAllowed, isValidPort } from './address-policy';

const FORBIDDEN = [
  // unspecified
  '0.0.0.0',
  '0.1.2.3',
  '::',
  '0:0:0:0:0:0:0:0',
  // metadata
  '169.254.169.254',
  '100.100.100.200',
  '192.0.0.192',
  'fd00:ec2::254',
  'FD00:EC2:0:0:0:0:0:254',
  '::ffff:169.254.169.254',
  '::ffff:a9fe:a9fe',
  '[fd00:ec2::254]',
  // multicast, reserved, broadcast, documentation, benchmarking, IETF
  '224.0.0.1',
  '239.255.255.255',
  'ff02::1',
  '240.0.0.1',
  '255.255.255.255',
  '192.0.2.1',
  '198.51.100.7',
  '203.0.113.9',
  '2001:db8::1',
  '198.18.0.1',
  '198.19.255.255',
  '192.0.0.1',
  '192.88.99.1',
  // transition and embedding prefixes, every spelling
  '::127.0.0.1',
  '::7f00:1',
  '0:0:0:0:0:0:7f00:1',
  '64:ff9b::7f00:1',
  '64:ff9b::127.0.0.1',
  '64:ff9b::808:808',
  '64:ff9b:1::1',
  '2002:7f00:1::',
  '2002:c0a8:101::1',
  '2001::1',
  '2001:0:4136:e378:8000:63bf:3fff:fdd2',
  '100::1',
  '2001:10::1',
  '2001:20::1',
  'fec0::1',
  // outside 2000::/3
  '4000::1',
  '8000::1',
  'e000::1',
  // unparseable
  '',
  'abc',
  '1.2.3',
  '1.2.3.4.5',
  '999.1.1.1',
  'fe80::1%eth0',
  '::1%lo0',
  '2130706433',
  '0x7f.1',
  '127.1',
  '1:2:3:4:5:6:7:8:9',
  '1::2::3',
  '::g',
];

const METADATA = [
  '169.254.170.2',
  '169.254.170.23',
  '168.63.129.16',
  'fd00:ec2::23',
  'fd20:ce::254',
  '::ffff:169.254.170.2',
  '::ffff:a9fe:aa17',
  '[fd20:ce::254]',
  'FD20:CE:0:0:0:0:0:254',
];

const PRIVATE = [
  '127.0.0.1',
  '127.1.2.3',
  '127.255.255.255',
  '::1',
  '0:0:0:0:0:0:0:1',
  '[::1]',
  '::ffff:127.0.0.1',
  '::FFFF:127.0.0.1',
  '::ffff:7f00:1',
  '0:0:0:0:0:ffff:7f00:1',
  '10.0.0.1',
  '10.255.255.255',
  '::ffff:a00:1',
  '::ffff:10.1.2.3',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '192.168.255.255',
  '100.64.0.1',
  '100.127.255.255',
  '169.254.0.1',
  '169.254.169.253',
  '169.254.169.255',
  'fe80::1',
  'febf::1',
  'fc00::1',
  'fd00::1',
  'fd00:ec2::255',
  'fdff::1',
];

const PUBLIC = [
  '1.1.1.1',
  '8.8.8.8',
  '93.184.216.34',
  '172.15.255.255',
  '172.32.0.0',
  '100.63.255.255',
  '100.128.0.0',
  '169.253.255.255',
  '169.255.0.0',
  '192.169.0.1',
  '192.167.255.255',
  '11.0.0.1',
  '126.255.255.255',
  '128.0.0.1',
  '223.255.255.255',
  '2606:4700::1111',
  '2a00:1450:4001::1',
  '::ffff:1.1.1.1',
  '::ffff:101:101',
  '[2606:4700::1111]',
];

describe('classifyAddress', () => {
  it.each(METADATA)('forbids metadata endpoint %s', (address) => {
    expect(classifyAddress(address)).toBe('forbidden');
    expect(isAddressAllowed(address, true)).toBe(false);
  });
  it('keeps neighbours of the new metadata endpoints reachable', () => {
    expect(classifyAddress('169.254.170.3')).toBe('private');
    expect(classifyAddress('fd20:ce::255')).toBe('private');
    expect(classifyAddress('168.63.129.17')).toBe('public');
  });
  it.each(FORBIDDEN)('forbids %j', (address) => {
    expect(classifyAddress(address)).toBe('forbidden');
  });
  it.each(PRIVATE)('classes %s as private', (address) => {
    expect(classifyAddress(address)).toBe('private');
  });
  it.each(PUBLIC)('classes %s as public', (address) => {
    expect(classifyAddress(address)).toBe('public');
  });
});

describe('isAddressAllowed', () => {
  it.each(PUBLIC)('allows public %s with and without the opt-in', (address) => {
    expect(isAddressAllowed(address, false)).toBe(true);
    expect(isAddressAllowed(address, true)).toBe(true);
  });
  it.each(PRIVATE)('denies private %s by default and allows it with the opt-in', (address) => {
    expect(isAddressAllowed(address, false)).toBe(false);
    expect(isAddressAllowed(address, true)).toBe(true);
  });
  it.each(FORBIDDEN)('never allows %j, even with the opt-in', (address) => {
    expect(isAddressAllowed(address, false)).toBe(false);
    expect(isAddressAllowed(address, true)).toBe(false);
  });
});

describe('ports', () => {
  it.each([9091, 443, 80, 8080, 8443, 65535, 6680])('allows %d', (port) => {
    expect(isPortAllowed(port)).toBe(true);
  });
  it.each([25, 22, 6667, 6665, 6669, 21, 23, 110, 143, 587, 10080, 1, 5060])('refuses bad port %d', (port) => {
    expect(isPortAllowed(port)).toBe(false);
    expect(isValidPort(port)).toBe(true);
  });
  it.each([0, -1, 65536, 1.5, NaN, Infinity, '80', null, undefined, {}])('rejects invalid port %j', (port) => {
    expect(isValidPort(port)).toBe(false);
    expect(isPortAllowed(port)).toBe(false);
  });
  it('keeps the bad-port list free of duplicates and out-of-range entries', () => {
    expect(BAD_PORTS.size).toBe(82);
    expect([...BAD_PORTS].every(isValidPort)).toBe(true);
  });
});
