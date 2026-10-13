// CSV fayllarni UTF-8 BOM bilan eksport qilish (O'zbekcha belgilar buzilmasligi uchun)

export const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  try {
    const processRow = (row: (string | number)[]) => {
      return row
        .map((val) => {
          if (val === null || val === undefined) return '""';
          const stringVal = String(val).replace(/"/g, '""');
          return `"${stringVal}"`;
        })
        .join(';'); // O'zbekiston/MDH mintaqasi Excel dasturi uchun ';' separator eng qulayi
    };

    const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';');
    const bodyLines = rows.map(processRow).join('\r\n');
    const csvContent = '\uFEFF' + headerLine + '\r\n' + bodyLines;

    // Web muhitda yuklab olish
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('CSV eksport qilishda xatolik:', error);
    return false;
  }
};
