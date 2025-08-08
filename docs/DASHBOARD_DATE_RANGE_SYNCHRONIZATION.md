# Dashboard Date Range Synchronization

## Overview

All dashboard APIs now support unified date range filtering to ensure data consistency across different endpoints. The date range system allows you to filter data by predefined periods or custom date ranges.

## Supported Date Range Types

### 1. Today (`today`)

- **Description**: Data from the current day (00:00:00 to 23:59:59)
- **Parameter**: `dateRange=today`
- **Example**: `GET /api/v1/dashboard/statistics?dateRange=today`

### 2. Last 7 Days (`last_7_days`)

- **Description**: Data from the past 7 days including today
- **Parameter**: `dateRange=last_7_days`
- **Example**: `GET /api/v1/dashboard/statistics?dateRange=last_7_days`

### 3. Last 30 Days (`last_30_days`) - **Default**

- **Description**: Data from the past 30 days including today
- **Parameter**: `dateRange=last_30_days` (or omit for default)
- **Example**: `GET /api/v1/dashboard/statistics?dateRange=last_30_days`

### 4. Custom Date Range (`custom`)

- **Description**: Data between specific start and end dates
- **Parameters**:
  - `dateRange=custom`
  - `startDate=YYYY-MM-DD`
  - `endDate=YYYY-MM-DD`
- **Example**: `GET /api/v1/dashboard/statistics?dateRange=custom&startDate=2024-01-01&endDate=2024-01-31`

## Available Dashboard APIs

All the following endpoints now support the unified date range system:

### 1. Dashboard Statistics

```http
GET /api/v1/dashboard/statistics
```

**Parameters:**

- `dateRange` (optional): Date range type
- `startDate` (optional): Start date for custom range
- `endDate` (optional): End date for custom range
- `propertyId` (optional): Property ID(s) for filtering

### 2. Dashboard Overview

```http
GET /api/v1/dashboard/overview
```

**Parameters:**

- `dateRange` (optional): Date range type
- `startDate` (optional): Start date for custom range
- `endDate` (optional): End date for custom range
- `propertyId` (optional): Property ID(s) for filtering

### 3. Real-time Dashboard Data

```http
GET /api/v1/dashboard/realtime
```

**Parameters:**

- `dateRange` (optional): Date range type
- `startDate` (optional): Start date for custom range
- `endDate` (optional): End date for custom range
- `propertyId` (optional): Property ID(s) for filtering

### 4. Revenue Chart Data

```http
GET /api/v1/dashboard/revenue-chart
```

**Parameters:**

- `dateRange` (optional): Date range type
- `startDate` (optional): Start date for custom range
- `endDate` (optional): End date for custom range
- `propertyId` (optional): Property ID(s) for filtering

## Usage Examples

### Example 1: Get Today's Statistics

```http
GET /api/v1/dashboard/statistics?dateRange=today
```

### Example 2: Get Last Week's Overview

```http
GET /api/v1/dashboard/overview?dateRange=last_7_days
```

### Example 3: Get Custom Date Range Revenue Chart

```http
GET /api/v1/dashboard/revenue-chart?dateRange=custom&startDate=2024-01-01&endDate=2024-01-31
```

### Example 4: Get Last 30 Days Data (Default)

```http
GET /api/v1/dashboard/statistics
```

### Example 5: Combine Date Range with Property Filter

```http
GET /api/v1/dashboard/statistics?dateRange=last_7_days&propertyId=507f1f77bcf86cd799439011
```

## Role-Based Data Filtering

The date range system works in conjunction with role-based access control:

- **Admin Users**: Can access all data within the specified date range
- **Staff Users**: Can only access data for properties they manage within the specified date range

## Data Consistency

When using the same date range parameters across different dashboard APIs, you can expect:

1. **Consistent Time Periods**: All APIs will use the same date range calculation
2. **Synchronized Data**: Statistics will reflect the same time period
3. **Unified Filtering**: Property filtering works consistently across all endpoints

## Implementation Details

### Date Range Calculation

- **Today**: From 00:00:00 to 23:59:59 of the current day
- **Last 7 Days**: From 7 days ago 00:00:00 to today 23:59:59
- **Last 30 Days**: From 30 days ago 00:00:00 to today 23:59:59
- **Custom**: From start date 00:00:00 to end date 23:59:59

### Timezone Handling

- All date calculations use the server's local timezone
- Date strings are formatted as `YYYY-MM-DD`
- Time components are set to ensure full day coverage

### Error Handling

- Invalid date formats will return a 400 Bad Request error
- Missing start/end dates for custom ranges will return an error
- Invalid date range types will default to "Last 30 Days"

## Frontend Integration

To implement synchronized date range selection in your frontend:

1. **Create a Date Range Selector Component**

   ```typescript
   interface DateRangeSelector {
     dateRange: 'today' | 'last_7_days' | 'last_30_days' | 'custom';
     startDate?: string;
     endDate?: string;
   }
   ```

2. **Apply to All Dashboard API Calls**

   ```typescript
   const fetchDashboardData = async (dateRange: DateRangeSelector) => {
     const params = new URLSearchParams({
       dateRange: dateRange.dateRange,
       ...(dateRange.startDate && { startDate: dateRange.startDate }),
       ...(dateRange.endDate && { endDate: dateRange.endDate }),
     });

     const statistics = await fetch(`/api/v1/dashboard/statistics?${params}`);
     const overview = await fetch(`/api/v1/dashboard/overview?${params}`);
     const realtime = await fetch(`/api/v1/dashboard/realtime?${params}`);
     const revenueChart = await fetch(
       `/api/v1/dashboard/revenue-chart?${params}`,
     );
   };
   ```

3. **Update URL Parameters**
   ```typescript
   const updateURLParams = (dateRange: DateRangeSelector) => {
     const url = new URL(window.location.href);
     url.searchParams.set('dateRange', dateRange.dateRange);
     if (dateRange.startDate)
       url.searchParams.set('startDate', dateRange.startDate);
     if (dateRange.endDate) url.searchParams.set('endDate', dateRange.endDate);
     window.history.pushState({}, '', url.toString());
   };
   ```

## Migration Notes

If you're updating from the previous version:

1. **Backward Compatibility**: Existing API calls without `dateRange` will default to "Last 30 Days"
2. **Parameter Changes**:
   - `startDate` and `endDate` now work with the `dateRange=custom` parameter
   - All endpoints now accept the same date range parameters
3. **Response Format**: Response formats remain the same, only the data filtering has changed

## Troubleshooting

### Common Issues

1. **Date Range Not Applied**

   - Ensure you're using the correct `dateRange` parameter values
   - Check that custom date ranges include both `startDate` and `endDate`

2. **Timezone Mismatches**

   - All dates are processed in server timezone
   - Ensure your frontend sends dates in `YYYY-MM-DD` format

3. **Property Filtering Issues**
   - Verify that the `propertyId` parameter is valid
   - Check user permissions for the specified properties

### Debug Information

The revenue chart endpoint includes debug logging that can help troubleshoot date range issues:

- Check server logs for date range calculations
- Verify property filter application
- Confirm user role and permissions
