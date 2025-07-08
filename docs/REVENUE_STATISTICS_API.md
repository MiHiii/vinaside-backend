# API Thống Kê Doanh Thu Listing

## Tổng quan

API này cung cấp dữ liệu thống kê doanh thu theo thời gian để hiển thị biểu đồ chart trên Frontend.

## Endpoint

```
GET /listings/revenue-statistics/:id
```

## Parameters

### Path Parameters

- `id` (string, required): ID của listing

### Query Parameters

- `startDate` (string, optional): Ngày bắt đầu thống kê (format: YYYY-MM-DD)
- `endDate` (string, optional): Ngày kết thúc thống kê (format: YYYY-MM-DD)
- `groupBy` (string, optional): Nhóm theo thời gian
  - `day`: Theo ngày (mặc định)
  - `week`: Theo tuần
  - `month`: Theo tháng
  - `year`: Theo năm

## Response Format

```json
{
  "success": true,
  "message": "Lấy thống kê doanh thu thành công",
  "data": {
    "listingId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "listingTitle": "Căn hộ cao cấp tại Quận 1",
    "totalRevenue": 15000000,
    "totalBookings": 25,
    "averageOccupancyRate": 75,
    "chartData": [
      {
        "date": "01/12/2024",
        "revenue": 1200000,
        "bookings": 2,
        "occupancyRate": 100
      },
      {
        "date": "02/12/2024",
        "revenue": 800000,
        "bookings": 1,
        "occupancyRate": 100
      }
    ]
  }
}
```

## Cách sử dụng cho Frontend

### 1. Hiển thị biểu đồ doanh thu

```javascript
// Gọi API
const response = await fetch(
  '/api/listings/revenue-statistics/64f8a1b2c3d4e5f6a7b8c9d0?startDate=2024-12-01&endDate=2024-12-31&groupBy=day',
);

const data = await response.json();

// Dữ liệu cho biểu đồ
const chartData = data.data.chartData;

// Sử dụng với Chart.js
const ctx = document.getElementById('revenueChart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartData.map((item) => item.date),
    datasets: [
      {
        label: 'Doanh thu',
        data: chartData.map((item) => item.revenue),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND',
            }).format(value);
          },
        },
      },
    },
  },
});
```

### 2. Hiển thị biểu đồ booking

```javascript
// Biểu đồ cột cho số lượng booking
const bookingChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: chartData.map((item) => item.date),
    datasets: [
      {
        label: 'Số booking',
        data: chartData.map((item) => item.bookings),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  },
});
```

### 3. Hiển thị biểu đồ occupancy rate

```javascript
// Biểu đồ cho tỷ lệ lấp đầy
const occupancyChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartData.map((item) => item.date),
    datasets: [
      {
        label: 'Tỷ lệ lấp đầy (%)',
        data: chartData.map((item) => item.occupancyRate),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y',
      },
    ],
  },
  options: {
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        max: 100,
        ticks: {
          callback: function (value) {
            return value + '%';
          },
        },
      },
    },
  },
});
```

### 4. Xử lý thay đổi khoảng thời gian

```javascript
// Hàm cập nhật biểu đồ khi thay đổi ngày
async function updateChart(startDate, endDate, groupBy = 'day') {
  const params = new URLSearchParams({
    startDate,
    endDate,
    groupBy,
  });

  const response = await fetch(
    `/api/listings/revenue-statistics/64f8a1b2c3d4e5f6a7b8c9d0?${params}`,
  );
  const data = await response.json();

  // Cập nhật dữ liệu biểu đồ
  chart.data.labels = data.data.chartData.map((item) => item.date);
  chart.data.datasets[0].data = data.data.chartData.map((item) => item.revenue);
  chart.update();
}

// Sử dụng với date picker
document.getElementById('startDate').addEventListener('change', function () {
  const startDate = this.value;
  const endDate = document.getElementById('endDate').value;
  const groupBy = document.getElementById('groupBy').value;

  updateChart(startDate, endDate, groupBy);
});
```

### 5. Hiển thị tổng quan

```javascript
// Hiển thị các chỉ số tổng quan
document.getElementById('totalRevenue').textContent = new Intl.NumberFormat(
  'vi-VN',
  {
    style: 'currency',
    currency: 'VND',
  },
).format(data.data.totalRevenue);

document.getElementById('totalBookings').textContent = data.data.totalBookings;

document.getElementById('averageOccupancy').textContent =
  data.data.averageOccupancyRate + '%';
```

## Các trường hợp sử dụng

### 1. Theo ngày (groupBy=day)

- Hiển thị doanh thu từng ngày
- Phù hợp cho khoảng thời gian ngắn (1-30 ngày)
- Date format: "01/12/2024"

### 2. Theo tuần (groupBy=week)

- Hiển thị doanh thu theo tuần
- Phù hợp cho khoảng thời gian trung bình (1-12 tuần)
- Date format: "Tuần 48, 2024"

### 3. Theo tháng (groupBy=month)

- Hiển thị doanh thu theo tháng
- Phù hợp cho khoảng thời gian dài (3-24 tháng)
- Date format: "12/2024"

### 4. Theo năm (groupBy=year)

- Hiển thị doanh thu theo năm
- Phù hợp cho thống kê dài hạn
- Date format: "2024"

## Lưu ý

1. **Occupancy Rate**:

   - Theo ngày: 100% nếu có booking, 0% nếu không có
   - Theo tuần/tháng/năm: tính dựa trên tỷ lệ số đêm được book so với tổng số ngày

2. **Date Format**:

   - Backend trả về date string đã được format theo locale Việt Nam
   - Frontend có thể sử dụng trực tiếp cho label biểu đồ

3. **Currency**:

   - Doanh thu được trả về dưới dạng số nguyên (VND)
   - Frontend cần format thành currency string

4. **Empty Data**:
   - Nếu không có dữ liệu trong khoảng thời gian, API sẽ trả về mảng rỗng
   - Frontend cần xử lý trường hợp này để hiển thị thông báo phù hợp
