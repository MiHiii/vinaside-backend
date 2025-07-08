/**
 * Lấy khoảng thời gian mặc định (7 ngày gần nhất)
 */
export function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 6); // 7 ngày gần nhất (bao gồm hôm nay)
  return { startDate, endDate };
}

/**
 * Xác định cách nhóm dữ liệu dựa trên số ngày
 */
export function determineGroupBy(
  startDate: Date,
  endDate: Date,
  groupBy?: string,
): string {
  const daysCount =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;

  if (groupBy && groupBy !== 'auto') {
    return groupBy;
  }

  if (daysCount <= 31) return 'day';
  else if (daysCount <= 180) return 'week';
  else if (daysCount <= 730) return 'month';
  else return 'year';
}

/**
 * Lấy format và function label cho MongoDB aggregation
 */
export function getGroupFormat(groupBy: string): {
  format: string;
  labelFn: (v: string) => string;
} {
  switch (groupBy) {
    case 'week':
      return {
        format: '%G-%V', // ISO week
        labelFn: (v: string) => {
          const [year, week] = v.split('-');
          return `Tuần ${week}/${year}`;
        },
      };
    case 'month':
      return {
        format: '%Y-%m',
        labelFn: (v: string) => {
          const [year, month] = v.split('-');
          return `Tháng ${month}/${year}`;
        },
      };
    case 'year':
      return {
        format: '%Y',
        labelFn: (v: string) => `Năm ${v}`,
      };
    default: // day
      return {
        format: '%Y-%m-%d',
        labelFn: (v: string) => new Date(v).toLocaleDateString('vi-VN'),
      };
  }
}

/**
 * Tạo mảng labels liên tục cho biểu đồ
 */
export function generateLabels(
  startDate: Date,
  endDate: Date,
  groupBy: string,
): string[] {
  const labels: string[] = [];

  if (groupBy === 'day') {
    const d = new Date(startDate);
    while (d <= endDate) {
      labels.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  } else if (groupBy === 'week') {
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
      const year = d.getUTCFullYear();
      const week = getISOWeek(d);
      labels.push(`${year}-${String(week).padStart(2, '0')}`);
      d.setDate(d.getDate() + 7 - d.getDay());
    }
  } else if (groupBy === 'month') {
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      labels.push(`${year}-${month}`);
      d.setMonth(d.getMonth() + 1);
    }
  } else if (groupBy === 'year') {
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
      const year = d.getUTCFullYear();
      labels.push(`${year}`);
      d.setFullYear(d.getFullYear() + 1);
    }
  }

  return labels;
}

/**
 * Helper function lấy số tuần ISO
 */
export function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNo;
}
