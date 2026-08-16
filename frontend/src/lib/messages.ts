/**
 * Centralized user-facing messages for BRCE.
 * Keep wording consistent across Admin, Staff, Instructor, Student, and Public surfaces.
 * Never put technical / database / JWT / RLS details in these strings.
 */

export const MESSAGES = {
  // ─── Generic ───────────────────────────────────────────────────────────────
  UNEXPECTED: {
    title: 'Something went wrong',
    description:
      'Something went wrong. Please try again in a few moments. If the problem continues, contact your administrator.',
  },
  NETWORK: {
    title: 'Connection problem',
    description:
      'We could not reach the server. Please check your internet connection and try again.',
  },
  SESSION_EXPIRED: {
    title: 'Session expired',
    description: 'Your session has expired. Please sign out, sign back in, and try again.',
  },
  LOAD_FAILED: {
    title: 'Unable to load data',
    description: 'We could not load the requested information. Please refresh the page and try again.',
  },
  SAVE_FAILED: {
    title: 'Unable to save',
    description: 'We could not save your changes. Please try again.',
  },
  DELETE_FAILED: {
    title: 'Unable to delete',
    description: 'We could not complete the deletion. Please try again.',
  },
  UPDATE_FAILED: {
    title: 'Unable to update',
    description: 'We could not update this record. Please try again.',
  },
  NOT_FOUND: {
    title: 'Not found',
    description: 'The requested item could not be found.',
  },

  // ─── Access / permissions (role-aware, non-technical) ──────────────────────
  ACCESS: {
    DENIED: {
      title: 'Access denied',
      description:
        'You do not have permission to access this feature. Please contact your administrator if you believe this is a mistake.',
    },
    DENIED_ACTION: {
      title: 'Permission denied',
      description:
        'You do not have permission to perform this action. Please contact your administrator if you believe this is a mistake.',
    },
    ADMIN_ONLY: {
      title: 'Permission denied',
      description: 'Only an administrator can perform this action.',
    },
    STAFF_STUDENT_ONLY: {
      title: 'Permission denied',
      description: 'Staff may only create student accounts.',
    },
    MUST_LOGIN: {
      title: 'Sign in required',
      description: 'Please sign in to continue.',
    },
  },

  // ─── Auth ──────────────────────────────────────────────────────────────────
  AUTH: {
    INVALID_CREDENTIALS: {
      title: 'Sign-in failed',
      description: 'Invalid email or password. Please check your credentials and try again.',
    },
    MISSING_CREDENTIALS: 'Please enter both your email/ID and password.',
    USE_EMAIL: 'Please sign in with your full email address.',
    NO_PROFILE:
      'No profile was found for this account. Please contact your administrator for assistance.',
    SUSPENDED:
      'Your account has been suspended. Please contact your administrator for assistance.',
    TENANT_SUSPENDED:
      'This institution has been suspended. Access is restricted until the platform reactivates it. Please contact platform support.',
    PENDING_APPROVAL:
      'Your account is waiting for approval. You cannot sign in until an administrator approves your registration.',
    REGISTRATION_FEE_REQUIRED:
      'You cannot sign in until your registration fee is paid. Please contact your institution office to complete payment, then try again.',
    FORGOT_PASSWORD: 'Please contact your administrator to recover your password.',
    PLATFORM_ADMIN_ONLY: {
      title: 'Access denied',
      description:
        'Only institution admins can sign in on the TvetFlow platform. Staff, instructors, affiliates, and students must use their institution landing page (/?tenant=your-slug).',
    },
    WRONG_INSTITUTION: {
      title: 'Access denied',
      description:
        'This account does not belong to this institution. Sign in from your own institution landing page only.',
    },
    SIGNUP_FAILED: {
      title: 'Registration failed',
      description: 'We could not create your account. Please try again.',
    },
  },

  // ─── Validation ────────────────────────────────────────────────────────────
  VALIDATION: {
    REQUIRED: 'This field is required.',
    FULL_NAME: 'Please enter your full name.',
    EMAIL: 'Please provide a valid email address.',
    EMAIL_REQUIRED: 'Please enter your email address.',
    PASSWORD_MIN: 'Password must contain at least 8 characters.',
    PASSWORD_REQUIRED: 'Please enter your password.',
    PHONE: 'Please provide a valid phone number.',
    PHONE_REQUIRED: 'Please enter a phone number.',
    STUDENT_ID: 'Please enter a valid student ID.',
    SELECT_CLASS: 'Please select a class.',
    SELECT_COURSE: 'Please select a course.',
    SELECT_STUDENT: 'Please select a student.',
    SELECT_DATE: 'Please select a date.',
    AMOUNT: 'Please enter a valid amount.',
    INVALID_INPUT: 'Please check the highlighted fields and try again.',
  },

  // ─── Duplicates ────────────────────────────────────────────────────────────
  DUPLICATE: {
    EMAIL: {
      title: 'Email already in use',
      description:
        'An account with this email address already exists. Please use a different email or sign in if this account belongs to you.',
    },
    INSTITUTION_SLUG: {
      title: 'Slug already in use',
      description: 'Institution slug is already in use.',
    },
    PHONE: {
      title: 'Phone already in use',
      description:
        'An account with this phone number already exists. Please use a different number or contact your administrator.',
    },
    STUDENT_ID: {
      title: 'Student ID already exists',
      description: 'A student with this ID already exists. Please use a different ID.',
    },
    GENERIC: {
      title: 'Already exists',
      description: 'This record already exists. Please check your details and try again.',
    },
    EXAM_RESULT: {
      title: 'Duplicate result',
      description:
        'This student already has a result for this exam. Would you like to update it instead?',
    },
    ENROLLMENT: {
      title: 'Already enrolled',
      description: 'This student is already enrolled in the selected class.',
    },
  },

  // ─── Success ───────────────────────────────────────────────────────────────
  SUCCESS: {
    GENERIC: 'Saved successfully.',
    CREATED: 'Created successfully.',
    UPDATED: 'Updated successfully.',
    DELETED: 'Deleted successfully.',
    TENANT_CREATED: 'Tenant created successfully.',
    TENANT_ADMIN_CREATED: 'Tenant Admin account created successfully.',
    STUDENT_CREATED: 'Student created successfully.',
    STUDENT_UPDATED: 'Student updated successfully.',
    STUDENT_DELETED: 'Student deleted successfully.',
    STAFF_CREATED: 'Staff account created successfully.',
    INSTRUCTOR_CREATED: 'Instructor account created successfully.',
    ADMIN_CREATED: 'Administrator account created successfully.',
    AFFILIATE_CREATED: 'Affiliate account created successfully.',
    USER_CREATED: 'User account created successfully.',
    USER_UPDATED: 'User updated successfully.',
    USER_DELETED: 'User deleted successfully.',
    ROLE_UPDATED: 'User role updated successfully.',
    COURSE_CREATED: 'Course created successfully.',
    COURSE_UPDATED: 'Course updated successfully.',
    COURSE_DELETED: 'Course deleted successfully.',
    CLASS_CREATED: 'Class created successfully.',
    CLASS_UPDATED: 'Class updated successfully.',
    CLASS_DELETED: 'Class deleted successfully.',
    ENROLLMENT_SAVED: 'Enrollment saved successfully.',
    PAYMENT_RECORDED: 'Payment recorded successfully.',
    ATTENDANCE_SAVED: 'Attendance saved successfully.',
    PROFILE_UPDATED: 'Profile updated successfully.',
    ASSIGNMENT_CREATED: 'Assignment created successfully.',
    ASSIGNMENT_UPDATED: 'Assignment updated successfully.',
    ASSIGNMENT_DELETED: 'Assignment deleted successfully.',
    GRADE_SAVED: 'Grade saved successfully.',
    EXAM_SAVED: 'Exam saved successfully.',
    EXAM_DELETED: 'Exam deleted successfully.',
    RESULT_SAVED: 'Exam result saved successfully.',
    RESULT_DELETED: 'Exam result deleted successfully.',
    CERTIFICATE_GENERATED: 'Certificate generated successfully.',
    CERTIFICATE_NONE_ELIGIBLE:
      'No enrollments met certificate requirements (class finished, grades complete, and fully paid).',
    REGISTRATION_SUBMITTED: 'Registration submitted successfully.',
    WITHDRAWAL_SUBMITTED: 'Withdrawal request submitted successfully.',
    TRANSFER_COMPLETED: 'Student transferred successfully.',
    DISCOUNT_SAVED: 'Discount saved successfully.',
    DOCUMENT_UPLOADED: 'Document uploaded successfully.',
    AFFILIATE_SUBMITTED: 'Affiliate request submitted successfully.',
  },

  // ─── Domain-specific friendly fallbacks ────────────────────────────────────
  DOMAIN: {
    RESULTS_LOAD: 'Unable to load results. Please refresh the page.',
    ATTENDANCE_SAVE: 'Unable to save attendance. Please try again.',
    PAYMENT_SAVE: 'Unable to save the payment record. Please try again.',
    REGISTRATION_FEE_FIRST:
      'This student must pay the registration fee before any other payments can be recorded.',
    ENROLLMENT_FAILED: 'Unable to enroll the student. Please try again.',
    TRANSFER_FAILED: 'Unable to transfer the student. Please try again.',
    CERTIFICATE_VERIFY: 'Certificate could not be verified. Please check the details and try again.',
    CERTIFICATE_NOT_FOUND: 'Document not found or not yet valid.',
    CERTIFICATE_DOWNLOAD: 'Unable to download the certificate. Please try again.',
    CERTIFICATE_ALREADY_ISSUED: 'A certificate has already been issued for this enrollment.',
    CLASS_NOT_FINISHED:
      'Certificates can only be issued after the class end date has passed or the class is marked inactive.',
    GRADES_INCOMPLETE:
      'Record and finalize grades (exams/gradebook, 60+ on required courses) before issuing a certificate.',
    BALANCE_OUTSTANDING:
      'The student must clear tuition and registration fee balances before a certificate can be issued.',
    CERTIFICATE_ENROLLMENT_REQUIRED: 'Certificates must be linked to a student enrollment.',
    EXPORT_FAILED: 'Unable to generate the export file. Please try again.',
    EMAIL_SEND_FAILED:
      'The account was created, but the welcome email could not be sent. Please share the login details manually.',
    BULK_IMPORT_READ: 'Unable to read the selected file. Please check the format and try again.',
    STUDENT_DELETE_ADMIN:
      'Only a tenant administrator can permanently delete students.',
    STUDENT_NOT_FOUND: 'Student not found.',
    DELETION_DEPENDENCIES:
      'This item could not be deleted because related records still depend on it. Please remove those first, then try again.',
  },
} as const;

/** Flat helpers for toast titles used repeatedly */
export const TOAST_TITLES = {
  SUCCESS: 'Success',
  ERROR: 'Error',
  VALIDATION: 'Please check your input',
  PERMISSION: 'Permission denied',
} as const;
