# Property Staff Assignment API Documentation

## Overview

PropertyStaffAssignment module quản lý việc assign/unassign staff cho các property. Module này cung cấp đầy đủ chức năng để quản lý nhân viên được phân công cho từng property.

## Endpoints

### 1. Assign Staff to Property

**POST** `/property-staff-assignment/assign`

Assign một staff vào property.

**Headers:**

- Authorization: Bearer {token}

**Body:**

```json
{
  "propertyId": "ObjectId",
  "staffId": "ObjectId",
  "notes": "Optional notes about assignment"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "ObjectId",
    "propertyId": "ObjectId",
    "staffId": "ObjectId",
    "assignedBy": "ObjectId",
    "status": "active",
    "assignedAt": "2024-01-01T00:00:00.000Z",
    "notes": "Assignment notes",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Unassign Staff from Property

**POST** `/property-staff-assignment/unassign`

Unassign một staff khỏi property.

**Headers:**

- Authorization: Bearer {token}

**Body:**

```json
{
  "propertyId": "ObjectId",
  "staffId": "ObjectId",
  "unassignNotes": "Optional notes about unassignment"
}
```

### 3. Get Staff by Property

**GET** `/property-staff-assignment/property/{propertyId}/staff`

Lấy danh sách staff được assign cho một property.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "propertyId": "ObjectId",
      "staffId": {
        "_id": "ObjectId",
        "name": "Staff Name",
        "email": "staff@example.com",
        "phone": "0123456789"
      },
      "assignedBy": {
        "_id": "ObjectId",
        "name": "Admin Name",
        "email": "admin@example.com"
      },
      "status": "active",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "notes": "Assignment notes"
    }
  ]
}
```

### 4. Get Properties by Staff

**GET** `/property-staff-assignment/staff/{staffId}/properties`

Lấy danh sách property mà một staff được assign.

### 5. Get Assignment History

**GET** `/property-staff-assignment/history?propertyId={propertyId}&staffId={staffId}`

Lấy lịch sử assignment (bao gồm cả active và inactive).

**Query Parameters:**

- propertyId (optional): Filter by property
- staffId (optional): Filter by staff
- status (optional): Filter by status

### 6. Check Staff Assignment

**GET** `/property-staff-assignment/check/{staffId}/{propertyId}`

Kiểm tra xem staff có được assign cho property hay không.

**Response:**

```json
{
  "success": true,
  "data": {
    "isAssigned": true
  }
}
```

### 7. Get All Assignments

**GET** `/property-staff-assignment/all`

Lấy tất cả assignment records.

## Permissions Required

- `property_staff:assign` - Để assign staff
- `property_staff:unassign` - Để unassign staff
- `property_staff:read` - Để đọc thông tin assignment

## Features

### 1. Unique Constraint

- Một staff chỉ có thể được assign một lần cho một property (với status active)
- Sử dụng compound index với partial filter

### 2. Assignment Status

- `active`: Staff đang được assign
- `inactive`: Staff đã được unassign
- `suspended`: Staff bị tạm ngưng

### 3. Audit Trail

- Ghi lại ai assign (`assignedBy`)
- Ghi lại ai unassign (`unassignedBy`)
- Ghi lại thời gian assign/unassign
- Ghi lại notes cho cả assign và unassign

### 4. Efficient Queries

- Index được tối ưu cho các query thông dụng
- Populate thông tin staff và property khi cần

## Usage Examples

```typescript
// Assign staff to property
const assignment = await propertyStaffAssignmentService.assignStaff(
  {
    propertyId: new Types.ObjectId('property_id'),
    staffId: new Types.ObjectId('staff_id'),
    notes: 'Staff được assign để quản lý property này',
  },
  adminId,
);

// Check if staff is assigned to property
const isAssigned =
  await propertyStaffAssignmentService.isStaffAssignedToProperty(
    staffId,
    propertyId,
  );

// Get all staff for a property
const staff =
  await propertyStaffAssignmentService.getStaffByProperty(propertyId);
```
