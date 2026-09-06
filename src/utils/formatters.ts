export function formatPhoneNumber(phoneStr?: string | null): string {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '');
  if (!digits) return String(phoneStr);

  // With Brazil DDI (55)
  if (digits.startsWith('55')) {
    const withoutDdi = digits.slice(2);
    if (withoutDdi.length === 11) {
      // 55 + 2-digit DDD + 9-digit number
      const ddd = withoutDdi.slice(0, 2);
      const part1 = withoutDdi.slice(2, 7);
      const part2 = withoutDdi.slice(7);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    if (withoutDdi.length === 10) {
      // 55 + 2-digit DDD + 8-digit number (convert to standard 9-digit)
      const ddd = withoutDdi.slice(0, 2);
      const isMobile = ['9', '8', '7', '6'].includes(withoutDdi.charAt(2));
      const fullNum = isMobile ? `9${withoutDdi.slice(2)}` : withoutDdi.slice(2);
      const part1 = fullNum.slice(0, 5);
      const part2 = fullNum.slice(5);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
  }

  // Without DDI (11 digits: DDD + 9 digits)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // Without DDI (10 digits: DDD + 8 digits)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6);
    return `+55 (${ddd}) 9${part1}-${part2}`;
  }

  return phoneStr.startsWith('+') ? phoneStr : `+${phoneStr}`;
}
