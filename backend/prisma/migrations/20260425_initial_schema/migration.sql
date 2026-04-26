-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "District" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Complaint" (
    "id" SERIAL NOT NULL,
    "complRegNum" TEXT,
    "complRegDt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "mobile" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "village" TEXT,
    "tehsil" TEXT,
    "addressDistrict" TEXT,
    "addressPs" TEXT,
    "receptionMode" TEXT,
    "incidentType" TEXT,
    "incidentPlc" TEXT,
    "incidentFromDt" TIMESTAMP(3),
    "incidentToDt" TIMESTAMP(3),
    "classOfIncident" TEXT,
    "respondentCategories" TEXT,
    "complaintSource" TEXT,
    "typeOfComplaint" TEXT,
    "complainantType" TEXT,
    "complaintPurpose" TEXT,
    "statusOfComplaint" TEXT,
    "disposalDate" TIMESTAMP(3),
    "ioDetails" TEXT,
    "branch" TEXT,
    "firNumber" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WomenSafety" (
    "id" SERIAL NOT NULL,
    "complRegNum" TEXT,
    "districtId" INTEGER,
    "complDesc" TEXT,
    "complRegDt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "mobile" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "village" TEXT,
    "tehsil" TEXT,
    "incidentType" TEXT,
    "incidentPlc" TEXT,
    "incidentFromDt" TIMESTAMP(3),
    "incidentToDt" TIMESTAMP(3),
    "complaintSource" TEXT,
    "statusOfComplaint" TEXT,
    "disposalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WomenSafety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CCTNSComplaint" (
    "id" SERIAL NOT NULL,
    "complRegNum" TEXT,
    "districtId" INTEGER,
    "compCategory" TEXT,
    "psrNumber" TEXT,
    "firNumber" TEXT,
    "firDate" TIMESTAMP(3),
    "ActSection" TEXT,
    "accusedName" TEXT,
    "accusedAge" INTEGER,
    "accusedAddress" TEXT,
    "victimName" TEXT,
    "incidentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CCTNSComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Office" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "districtId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "District_Master" (
    "id" BIGINT NOT NULL,
    "DistrictName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_Master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PoliceStation_Master" (
    "id" BIGINT NOT NULL,
    "Name" TEXT NOT NULL,
    "DistrictID" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliceStation_Master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Offices_Master" (
    "id" BIGINT NOT NULL,
    "Name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offices_Master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tb_nature_complaints" (
    "id" SERIAL NOT NULL,
    "nature_complaints" TEXT,

    CONSTRAINT "tb_nature_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tb_received_from" (
    "id" SERIAL NOT NULL,
    "recieved_from" TEXT,

    CONSTRAINT "tb_received_from_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "District_name_key" ON "District"("name");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Complaint_complRegNum_key" ON "Complaint"("complRegNum");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WomenSafety_complRegNum_key" ON "WomenSafety"("complRegNum");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CCTNSComplaint_complRegNum_key" ON "CCTNSComplaint"("complRegNum");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "District_Master_DistrictName_key" ON "District_Master"("DistrictName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_complRegDt_idx" ON "Complaint"("complRegDt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_statusOfComplaint_idx" ON "Complaint"("statusOfComplaint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_addressDistrict_idx" ON "Complaint"("addressDistrict");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_complRegDt_statusOfComplaint_idx" ON "Complaint"("complRegDt", "statusOfComplaint");

-- AddForeignKey
ALTER TABLE "WomenSafety" ADD CONSTRAINT "WomenSafety_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CCTNSComplaint" ADD CONSTRAINT "CCTNSComplaint_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
