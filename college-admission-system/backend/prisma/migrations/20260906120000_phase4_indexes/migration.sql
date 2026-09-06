-- Phase 4: supports filtering programs by department, and sorting/paginating
-- applications by creation date, without a full table scan.

-- CreateIndex
CREATE INDEX "programs_department_idx" ON "programs"("department");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");
