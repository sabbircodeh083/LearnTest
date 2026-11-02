# LearnTest
## Product, Frontend, and Backend API Specification

**Document version:** 1.1  
**API version:** 1.0.0  
**Product:** LearnTest  
**Frontend:** Next.js  
**Backend:** Express.js with TypeScript  
**Database:** MongoDB Atlas with Mongoose  
**Authentication:** Better Auth with cookie-based sessions  
**Payment gateway:** SSLCOMMERZ  
**Object storage:** Cloudflare R2  
**Malware scanning:** Bouncer  
**API base URL during local development:** `http://localhost:4000`

---

# 1. Product Overview

## 1.1 Purpose

LearnTest is an educational platform designed to help students evaluate their knowledge, discover learning materials, take examinations, submit assignments, and monitor their academic progress.

The platform also provides teachers with tools to publish educational videos, organize learning content, create assessments, manage students, and monitor the performance of their educational materials.

LearnTest will use a shared design system with separate, role-specific experiences for students, teachers, and administrators.

The frontend must provide an intuitive, responsive interface, while the backend handles authentication, authorization, data validation, examination access, file security, payments, and content entitlements.

## 1.2 Product Goals

The primary goals are to:

1. Help students discover questions and assess their knowledge.
2. Provide educational videos and organized learning resources.
3. Allow students to take examinations and submit assignments.
4. Enable teachers to publish and manage educational content.
5. Support paid educational content through SSLCOMMERZ.
6. Protect uploaded files through private storage, malware scanning, and access control.
7. Provide administrators with appropriate system and user-management functionality.
8. Deliver a consistent experience across desktop, tablet, and mobile devices.

## 1.3 Target Users

### Students

Students use LearnTest to discover questions, watch educational videos, participate in examinations, submit assignments, access purchased content, and review their results.

### Teachers

Teachers use LearnTest to publish educational content, organize videos and questions, create examinations, manage learning materials, and monitor their students' engagement and performance.

### Administrators

Administrators manage platform users and access administrative overview information. Administrative operations must remain restricted to verified administrator accounts.

---

# 2. Technology Architecture

## 2.1 Frontend

The frontend will use Next.js and React.

Its responsibilities include:

- Rendering public and authenticated pages.
- Presenting separate student, teacher, and administrator interfaces.
- Communicating with the Express API.
- Managing form inputs and client-side validation.
- Displaying questions, videos, examinations, assignments, purchases, and results.
- Handling loading, error, empty, and success states.
- Providing light and dark themes.
- Maintaining authentication state based on the backend session.
- Redirecting users to protected payment gateway pages when required.
- Providing responsive and accessible user interfaces.

The frontend must not be responsible for making final authorization, payment-validation, or malware-safety decisions.

## 2.2 Backend

The backend will use Express.js with TypeScript.

Its responsibilities include:

- Managing API routes.
- Validating incoming requests.
- Integrating Better Auth.
- Enforcing role-based and resource-based access control.
- Reading and writing data through Mongoose.
- Managing video and examination operations.
- Handling assignment uploads.
- Integrating Cloudflare R2 and Bouncer.
- Initiating and validating SSLCOMMERZ transactions.
- Maintaining purchase and entitlement records.
- Providing administrative endpoints.

## 2.3 Database and Storage

MongoDB Atlas will store application data, including user profiles, educational content, examination records, assignments, purchase records, and access entitlements, as appropriate to the implemented data models.

Cloudflare R2 will store private uploaded files. Objects must not be publicly accessible by default.

The application must not expose database credentials, storage secrets, malware-scanning credentials, or payment gateway secrets to the frontend.

## 2.4 High-Level Architecture

The system will follow this architecture:

**Browser → Next.js frontend → Express API → MongoDB Atlas**

Additional integrations:

- **Authentication:** Next.js frontend and Express backend integrate with Better Auth.
- **Payments:** Express backend communicates with SSLCOMMERZ.
- **File storage:** Express backend manages objects in Cloudflare R2.
- **Malware scanning:** The backend integrates with Bouncer before uploaded files are approved for normal access.

The browser must not communicate directly with MongoDB, use private R2 credentials, or decide whether a payment is valid.

---

# 3. Frontend Design Specification

## 3.1 Design Direction

LearnTest will use a clean, modern educational interface with a YouTube Studio-inspired teacher dashboard.

The design must emphasize:

- Clear navigation.
- Minimal visual clutter.
- Readable educational content.
- Easy access to important actions.
- Distinct student and teacher workflows.
- Consistent spacing, typography, buttons, cards, and form controls.
- A green-and-white light theme.
- A black-and-charcoal dark theme.

The teacher experience may take inspiration from the organizational structure of YouTube Studio, but LearnTest must retain its own branding and purpose. The student interface should focus on learning and question discovery rather than copying a creator dashboard.

## 3.2 Color System

### Light Theme

| Design Element | Color | Purpose |
|---|---|---|
| Primary | `#16A34A` | Primary buttons, active navigation, highlights |
| Primary Hover | `#15803D` | Hover and stronger green emphasis |
| Main Background | `#FFFFFF` | Main page background |
| Secondary Background | `#F5F7F6` | Secondary sections and muted surfaces |
| Primary Text | `#111827` | Headings and primary content |
| Secondary Text | `#6B7280` | Supporting information |
| Borders | `#E5E7EB` | Card borders and separators |

### Dark Theme

| Design Element | Color | Purpose |
|---|---|---|
| Main Background | `#111315` | Main page background |
| Card Background | `#1B1E20` | Cards, panels, and secondary surfaces |
| Borders | `#34383A` | Borders and separators |
| Primary Accent | `#16A34A` | Buttons and active elements |

Text colors for dark mode must be chosen to remain readable against the dark surfaces.

The green accent must be used consistently across the platform. Color alone must not communicate an error, payment state, access restriction, or examination status; accompanying text or an appropriate icon must also be provided.

## 3.3 Typography and Spacing

The interface must use a consistent typography hierarchy:

- Page title: prominent and easy to distinguish.
- Section title: visually subordinate to the page title.
- Body text: readable at normal viewing distance.
- Supporting text: smaller but still legible.
- Labels: concise and positioned consistently with their inputs.

Use a consistent spacing system for page margins, card padding, sections, and form fields.

Avoid excessive shadows, unnecessary gradients, overloaded cards, and inconsistent corner radii.

Educational content, questions, and examination instructions must remain the visual priority.

## 3.4 Shared Application Layout

Authenticated pages should share a common application shell containing:

1. A persistent sidebar on desktop.
2. A compact top navigation bar.
3. A main content region.
4. A profile or account control.
5. A light/dark theme control.
6. Responsive navigation for smaller screens.

The sidebar should clearly identify the currently selected section.

The top bar may contain page-specific actions or contextual navigation when appropriate.

On smaller screens, the navigation must collapse into an appropriate mobile menu or drawer. The interface must not require horizontal scrolling for ordinary navigation or form interaction.

## 3.5 Shared Components

The frontend should use reusable components where appropriate, including:

- Application sidebar.
- Top navigation bar.
- Page heading.
- Primary and secondary buttons.
- Form fields and validation messages.
- Search input.
- Filter controls.
- Tabs.
- Video cards.
- Question cards.
- Examination cards.
- Purchase cards.
- Status badges.
- Confirmation dialogs.
- Dropdown menus.
- Pagination controls.
- Loading indicators and skeletons.
- Empty-state panels.
- Error messages and retry actions.
- Toast notifications.
- Theme selector.
- Profile menu.

Reusable components must support the visual requirements of their context without creating a separate, inconsistent design system for every page.

---

# 4. Authentication and Role-Based Experience

## 4.1 Supported Roles

LearnTest supports three application roles:

- `student`
- `teacher`
- `admin`

The signup endpoint accepts `student` and `teacher`. Public registration must not allow a user to create an administrator account.

Administrator provisioning must take place through the approved backend process.

## 4.2 Authentication Pages

The frontend must provide:

### Sign Up

Fields:

- Name.
- Email.
- Password.
- Role selection: student or teacher.

The form must display validation feedback and communicate that email verification is required.

The frontend must not submit `admin` as a registration role.

### Sign In

Fields:

- Email.
- Password.

The sign-in request must not include a role field. After authentication, the frontend must retrieve the current user's profile and role from the backend rather than trusting a role stored in form input or local storage.

### Email Verification

The interface must provide appropriate feedback for verification-related states. Access to features that require verified users must be determined by the backend.

### OAuth Onboarding

If an OAuth-authenticated user has not yet selected a role, the frontend must provide a role-selection step.

The role-selection request uses:

`POST /api/v1/me/select-role`

The available choices are `student` and `teacher`.

If a role has already been selected, the frontend must handle the backend's conflict response without treating it as a new role change.

### Session Handling

Authentication is handled through Better Auth using cookie-based sessions.

The frontend must:

- Include credentials when making cross-origin requests that require the session cookie.
- Retrieve the current profile from `GET /api/v1/me`.
- Handle `401 Unauthorized` responses.
- Handle `403 Forbidden` responses.
- Avoid treating client-side role state as an authorization mechanism.
- Clear or refresh client-side user state appropriately after sign-out or session expiration.

Session cookies and cross-origin behavior must be configured correctly for local development and production.

## 4.3 Role-Based Routing

The frontend should provide distinct route groups for each role.

Suggested route structure:

| Route Group | Example Pages | Access |
|---|---|---|
| Public | `/`, `/sign-in`, `/sign-up` | Public |
| Student | `/student`, `/student/questions`, `/student/my-exams` | Student |
| Teacher | `/teacher`, `/teacher/videos`, `/teacher/questions` | Teacher |
| Admin | `/admin`, `/admin/users` | Verified administrator |

These are proposed **frontend routes**, not existing backend endpoints.

Protected pages must check the current user's authenticated state and role. The backend remains the authoritative enforcement layer.

---

# 5. Student Frontend Specification

## 5.1 Student Experience

The student interface must prioritize finding useful learning materials and evaluating knowledge.

The student homepage must place **question discovery above video recommendations**. Educational videos remain important, but the first prominent learning interaction should help the student find questions or assessments.

The homepage should provide a clear path toward:

1. Discovering questions.
2. Continuing learning through videos.
3. Accessing examinations.
4. Reviewing ongoing work and previous results.
5. Managing purchases and saved content.

The design must avoid overwhelming students with too many independent dashboard widgets.

## 5.2 Student Navigation

The student sidebar must contain the following sections:

| Navigation Item | Purpose |
|---|---|
| Home | Learning overview and discovery |
| My Learning | Learning content and progress |
| Questions | Discover and explore questions |
| My Exams | Access available examinations and attempts |
| Assignments | View assignment information |
| My Submissions | Track submitted assignments |
| Results & Feedback | Review examination and assignment outcomes |
| Saved Content | Access saved learning materials |
| Purchases | Review purchased content |
| Following Teachers | Discover teachers the student follows |
| Settings | Manage account preferences |

These navigation items define the intended frontend experience. Their required data operations must be supported by implemented backend endpoints before the corresponding features can be considered complete.

## 5.3 Student Homepage

The homepage should contain the following areas.

### A. Welcome and Learning Overview

Display a welcome message and relevant learning information.

Where backend data is available, the overview may include:

- Recently accessed content.
- Available examinations.
- Pending assignments.
- Recent results.
- Learning progress.

The frontend must not fabricate progress values or display sample statistics as real user data.

### B. Question Discovery

Question discovery must appear before video recommendations.

The interface should support a clear search experience and question cards that present the information needed to decide whether to open a question.

The exact question fields, filtering capabilities, and sorting options must follow the final question data model and API contract.

Question discovery may eventually support searching by question title and hashtags. Those behaviors require an implemented question-discovery API; they are not defined in the currently supplied OpenAPI object.

### C. Video Recommendations

Video recommendations should appear below the question-discovery section.

Video cards should provide an appropriate presentation of the video title, teacher, thumbnail, and other metadata returned by the backend.

The currently specified `GET /api/v1/videos` endpoint lists published videos. A personalized recommendation algorithm is not defined in the current API specification, so the frontend must not imply that a personalization service already exists.

### D. Continue Learning

If relevant progress information is available from the backend, show recently accessed or incomplete learning content.

This section must be omitted, simplified, or supplied through a properly implemented API if progress tracking is not yet available.

## 5.4 Question Browsing and Question Details

The Questions page must provide a dedicated space for discovering and interacting with questions.

The intended interface should support:

- Question browsing.
- Search and filtering when supported by the API.
- Question details.
- Relevant topic or hashtag information.
- Clear access restrictions where applicable.
- Navigation to associated learning material when such relationships exist.

Do not invent a question schema, submit questions to a nonexistent endpoint, or display unsupported filters as functional controls.

The current OpenAPI object does not define question-discovery, question-detail, or question-submission endpoints. These must be specified and implemented before the corresponding interactions can be completed.

## 5.5 My Exams

The My Exams page should organize examinations available to the student.

Each examination card should display relevant information returned by the backend, such as the examination title, availability, and access requirements.

The interface must distinguish between starting an examination and continuing or reviewing an existing attempt when those states are supported by the backend.

Starting an examination uses:

`POST /api/v1/exams/{id}/attempts`

The frontend must handle:

- Successful attempt creation.
- Unauthenticated requests.
- Unauthorized access.
- Examination access restrictions.
- A `409` response when an attempt limit has been reached.

The current API contract does not define endpoints for retrieving examination questions, saving answers, submitting a completed attempt, or retrieving examination results. These operations require additional API specifications.

## 5.6 Assignments and Submissions

The Assignments page should show assignments and their instructions.

My Submissions should provide access to the student's submitted work and its status when that information is exposed by the backend.

The assignment upload operation uses:

`POST /api/v1/uploads/assignment`

The interface must communicate the allowed file types, file-size restrictions, upload progress when available, and the final state of the submission.

A successful upload response means that upload metadata was created; it must not automatically be interpreted as proof that the file is clean or that the assignment has been accepted.

The current API definition does not specify the endpoints required to list assignments, retrieve submission history, or review grading feedback. These must be added where required.

## 5.7 Results and Feedback

The Results & Feedback page should provide a clear way to review available examination results, assignment feedback, and related status information.

The interface must accurately distinguish between:

- Pending results.
- Published results.
- Graded submissions.
- Submissions awaiting review.
- Restricted information.

The exact statuses and their transitions must be defined by the backend contract. The current OpenAPI object does not include result-retrieval endpoints.

## 5.8 Saved Content and Following Teachers

Saved Content should provide a place for students to return to learning materials they have saved.

Following Teachers should list teachers the student follows, where this feature is supported.

Both features require backend support for their respective data and actions. The current OpenAPI object does not define save, unsave, follow, unfollow, or following-list endpoints.

The frontend must not simulate persistent saved or following states using local state alone while presenting them as saved to the user's account.

## 5.9 Purchases

The Purchases page must show purchases belonging to the authenticated student.

The page uses:

`GET /api/v1/purchases/me`

The frontend should display the purchased content, transaction or purchase status where provided, and a clear way to access content that the student is entitled to use.

The data model and response schema must determine the exact fields displayed.

---

# 6. Teacher Frontend Specification

## 6.1 Teacher Experience

The teacher dashboard will follow the finalized **YouTube Studio-inspired design direction**, adapted for educational content management.

The dashboard must emphasize content organization, useful management actions, clear navigation, and an uncluttered workspace.

The teacher interface must provide a consistent structure for video management, question management, examinations, student-related information, and profile settings.

## 6.2 Teacher Navigation

The teacher sidebar must contain:

| Navigation Item | Purpose |
|---|---|
| Dashboard | Summary of teaching activity |
| Videos | Manage educational videos |
| Playlists | Organize videos into playlists |
| Questions | Manage questions and question-related content |
| Exams | Manage examinations |
| Students | View student-related information |
| Analytics | Review supported content and engagement metrics |
| Earnings | Review supported earnings information |
| Profile | View and edit the teacher's public profile |
| Settings | Manage available account and application settings |

These items represent the intended interface. Each section must be connected to a real backend data source before it is considered functional.

The current OpenAPI object supports video listing and video creation, along with basic profile access and updates. It does not define the full set of operations required by every teacher navigation item.

## 6.3 Teacher Dashboard

The teacher homepage should provide a concise overview of teaching activities.

Depending on the available APIs, it may display:

- Published videos.
- Draft or unpublished content, if supported.
- Recently created questions.
- Examination activity.
- Student engagement.
- Performance analytics.
- Earnings or purchase-related summaries.

Only values returned by implemented backend services may be represented as real statistics.

Where a metric cannot yet be retrieved, do not manufacture a value or use a decorative chart that implies actual data.

## 6.4 Video Management

The Videos page must provide a dedicated workspace for managing educational videos.

The interface should distinguish video discovery or listing from video creation and other management actions.

The existing video-listing operation is:

`GET /api/v1/videos`

This endpoint is described as returning published videos.

The current API also supports:

`POST /api/v1/videos`

This operation is intended for verified teachers creating videos.

The video-creation form must follow the actual request schema implemented by the backend. Because the provided OpenAPI object does not describe the request body fields, those fields must be confirmed before the form is finalized.

The interface must handle successful creation and backend validation or authorization errors.

Publishing, editing, deleting, uploading thumbnails, managing unpublished videos, and retrieving individual video details require additional API definitions if they are part of the intended product.

## 6.5 Question Management

The Questions page must provide a focused workspace for teacher-created or teacher-managed questions.

Question management should be separate from video management so teachers can manage assessment content without navigating through the video library.

The design must also provide the finalized **highlighted-question interaction**:

- A highlighted-question card or dedicated drawer.
- Search by question title.
- Search by `#tags`.
- A clear presentation of matching questions.
- An easy way to open the relevant question or perform the supported management action.

The card or drawer must use the shared LearnTest design system and should not overwhelm the main workspace.

The interaction described above is a frontend requirement. The current API specification does not define question search, listing, creation, editing, deletion, tagging, or highlighting endpoints. Those operations must be implemented and specified before the interface can function end to end.

## 6.6 Playlists

The Playlists page should help teachers organize related videos into meaningful groups.

The final interface may provide playlist listing and management actions according to the implemented API.

The current OpenAPI object does not contain playlist endpoints. Playlist management must therefore be treated as a required API extension, not an existing capability.

## 6.7 Examination Management

The Exams page should provide a teacher-facing workspace for creating and managing examinations.

The eventual interface may include examination listing, creation, editing, question assignment, availability settings, and result management, depending on the finalized product scope.

However, the supplied API currently defines only the student operation for starting an examination attempt.

The teacher-facing examination-management endpoints and their request and response schemas still need to be defined.

## 6.8 Students, Analytics, and Earnings

The Students page should expose teacher-authorized student information.

Analytics should visualize real metrics returned by supported backend endpoints.

Earnings should display payment or revenue information only when the backend provides the required teacher-scoped data and permissions.

The current OpenAPI object does not define teacher-specific student lists, analytics, or earnings endpoints.

These sections should not be presented as fully operational dashboards until the backend contracts exist.

## 6.9 Teacher Profile

Teachers should be able to view and update the profile fields permitted by the backend.

Current profile operations:

- `GET /api/v1/me`
- `PATCH /api/v1/me`

The update operation must follow the backend's definition of safe profile fields. Role changes must not be offered through ordinary profile editing.

---

# 7. Administrator Frontend Specification

## 7.1 Administrator Access

The administrator experience must be separated from the student and teacher navigation.

Administrator pages must be accessible only to authenticated and authorized administrator accounts.

The frontend may hide unauthorized navigation items, but access control must also be enforced by the backend.

## 7.2 Administrative Overview

The administrative overview uses:

`GET /api/v1/admin/overview`

The endpoint is restricted to verified administrators.

The frontend should display only the data returned by the endpoint and must handle unauthorized and forbidden responses appropriately.

## 7.3 User Role Management

The current API defines:

`PATCH /api/v1/admin/users/{userId}/role`

This operation permits an administrator to change a user's student or teacher role with a reason. It must never be used to grant the admin role.

The frontend must provide appropriate confirmation and validation for this operation, including the required reason.

The exact request and response schemas must be confirmed from the backend implementation before the interface is finalized.

---

# 8. Backend API Specification

## 8.1 API Base URL

The current development server is:

`http://localhost:4000`

The production API URL must be configured through the frontend environment rather than hard-coded into individual components.

## 8.2 API Versioning

Application endpoints use the `/api/v1` prefix.

Better Auth endpoints use the `/api/auth/*` prefix.

The frontend must use the documented API paths and HTTP methods rather than constructing undocumented paths.

## 8.3 Authentication Scheme

Protected API routes use the Better Auth session cookie.

The authentication scheme is represented as:

```yaml
type: apiKey
in: cookie
name: better-auth.session_token
```

The browser must be configured to send the session cookie in the environments where the frontend and backend communicate across origins.

The frontend must not store backend secrets or treat a client-side role value as proof of authorization.

## 8.4 Health and Readiness

| Method | Endpoint | Purpose | Expected Status |
|---|---|---|---|
| GET | `/api/v1/health` | Liveness check | `200` |
| GET | `/api/v1/ready` | Database readiness check | `200` or `503` |

The health endpoint indicates whether the service is responding.

The readiness endpoint indicates whether the backend is ready to serve requests, including database readiness.

These endpoints are primarily for operations and diagnostics rather than normal student or teacher navigation.

## 8.5 Authentication Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/sign-up/email` | Register with email and password |
| POST | `/api/auth/sign-in/email` | Authenticate with email and password |
| GET | `/api/v1/me` | Retrieve current user profile and role |
| PATCH | `/api/v1/me` | Update permitted profile fields |
| POST | `/api/v1/me/select-role` | Select the initial role after applicable OAuth onboarding |

### Signup

The request supports the following fields:

- `name`
- `email`
- `password`
- `role`, optionally `student` or `teacher`

The backend must reject registration attempts that try to assign the admin role.

Expected responses include:

- `200`: Signup completed and verification email sent.
- `400`: Invalid input or role.

### Sign-In

The request contains email and password. The frontend must not submit the role.

Expected responses include:

- `200`: Successful sign-in and session cookie establishment.
- `401`: Invalid credentials or an unverified account.

### Current User

`GET /api/v1/me` retrieves the current user's profile and role.

Expected responses include:

- `200`: Profile returned.
- `401`: No valid authenticated session.

### Profile Update

`PATCH /api/v1/me` updates allowed profile fields, excluding the user's role.

Expected responses include:

- `200`: Updated profile.
- `400`: Invalid input.

### Role Selection

`POST /api/v1/me/select-role` is used for the initial role choice in the applicable OAuth onboarding flow.

Expected responses include:

- `200`: Role successfully selected.
- `409`: Role has already been selected.

The frontend must not use this endpoint as a regular role-switching mechanism.

## 8.6 Video Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/v1/videos` | List published videos | Defined by implementation |
| POST | `/api/v1/videos` | Create a video | Verified teacher |

The existing specification describes successful video creation as `201` and forbidden access as `403`.

The exact video request schema and response schema must be supplied by the backend contract.

## 8.7 Examination Endpoint

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/api/v1/exams/{id}/attempts` | Start an examination attempt | Student |

Expected responses include:

- `201`: Attempt created.
- `409`: Attempt limit reached.

The frontend must use the returned attempt data rather than assuming that an attempt was successfully created before receiving a successful response.

## 8.8 Assignment Upload Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/uploads/assignment` | Upload a student assignment |

The request uses multipart form data.

The API description specifies PDF and ZIP uploads, with file type validation that checks file signatures.

Expected responses include:

- `201`: Upload metadata created.
- `400`: File type or size rejected.

The exact file-size limits and response schema must be documented from the actual backend configuration.

## 8.9 Payment Initiation

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/payments/sslcommerz/initiate` | Begin a payment for content |

The frontend submits:

```json
{
  "contentType": "example-content-type",
  "contentId": "example-content-id"
}
```

The values above are illustrative placeholders, not a definitive list of valid content types or a production identifier.

The amount and currency must be determined by the backend from trusted database records. The frontend must not supply the authoritative payment amount.

The documented successful response contains:

- `purchaseId`
- `tranId`
- `gatewayUrl`

After a successful initiation response, the frontend may redirect the student to the returned gateway URL.

The payment initiation and redirect must be handled as separate steps. A successful initiation does not mean the payment has been completed.

## 8.10 SSLCOMMERZ IPN

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/payments/sslcommerz/ipn` | Receive payment notifications |

The IPN endpoint is a server-to-server integration point.

It must not be called directly by the normal browser payment flow as a substitute for server-side validation.

The endpoint is documented as idempotent and server-side validated.

The backend must validate the payment using the SSLCOMMERZ validation mechanism and verify the transaction information before completing the purchase and granting entitlement.

## 8.11 Purchases and Entitlements

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/purchases/me` | Retrieve the authenticated user's purchases |
| GET | `/api/v1/entitlements/{contentType}/{contentId}` | Check the authenticated user's entitlement to content |

These endpoints support the purchase history and access-control experience.

The frontend must use the entitlement response and backend access decisions to determine whether to show restricted or accessible content.

The precise response format and entitlement statuses must be documented in the final API schema.

## 8.12 Administrative Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/v1/admin/overview` | Retrieve administrative overview information | Verified admin |
| PATCH | `/api/v1/admin/users/{userId}/role` | Change a user's student or teacher role with a reason | Admin |

The user-role endpoint must not grant administrator privileges through a normal role-change request.

---

# 9. API Error and Response Handling

## 9.1 Standard Error Format

The documented error shape is:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "requestId": "request-id"
}
```

This is a representative error structure. The actual values for `code`, `message`, and `requestId` will depend on the request and backend implementation.

The frontend should extract a useful message when this structure is available and show a general error message when a response cannot be interpreted.

The supplied specification does not define one universal successful response envelope for every endpoint. The frontend must follow each endpoint's actual response schema rather than assuming that every successful response uses the same wrapper.

## 9.2 HTTP Status Handling

The frontend must account for at least the following response types:

| Status | Meaning | Frontend Behavior |
|---|---|---|
| `200` | Successful operation | Update or display returned data |
| `201` | Resource or attempt created | Display success and continue the workflow |
| `400` | Invalid request | Present validation or error feedback |
| `401` | Unauthenticated | Prompt authentication or refresh session state |
| `403` | Forbidden | Explain that access is not permitted |
| `409` | State conflict or limit reached | Explain the specific restriction |
| `503` | Service not ready | Display an appropriate temporary-unavailability message |

The frontend must not silently convert a failed request into a successful state.

## 9.3 Loading, Empty, and Error States

Every data-driven page should provide appropriate states for:

- Initial loading.
- Refreshing.
- Successful data retrieval.
- No results.
- Failed requests.
- Expired authentication.
- Unauthorized access.
- Restricted content.

Loading indicators must not remain indefinitely after a request fails.

Empty states should explain the current situation and provide a relevant next action when appropriate.

---

# 10. Video Access and Content Entitlement

The interface must distinguish between viewing a list of published videos and accessing the actual video content.

The current API defines a published-video listing endpoint, but it does not define a dedicated streaming endpoint or a complete video-detail contract.

If the product offers paid or otherwise restricted videos, the backend must authorize access before providing the protected content or its playback resources.

The frontend must not treat the presence of a video card or video identifier as proof that the student owns access to the video.

Where content entitlement is required, the frontend can use:

`GET /api/v1/entitlements/{contentType}/{contentId}`

The backend must remain responsible for deciding whether content access is allowed.

A video-detail API, media-delivery mechanism, and any required signed playback URL behavior must be specified separately before implementation.

---

# 11. Payment Workflow

## 11.1 Purpose

LearnTest must support purchases through SSLCOMMERZ without relying on client-controlled pricing or browser redirects as evidence of a successful payment.

## 11.2 Payment Flow

The intended workflow is:

1. The student selects paid content.
2. The frontend requests payment initiation from the backend.
3. The backend retrieves the authoritative price and currency from the database.
4. The backend creates or records the pending purchase and initiates the gateway transaction.
5. The frontend receives the returned gateway URL and redirects the student to SSLCOMMERZ.
6. SSLCOMMERZ processes the transaction.
7. The backend validates payment information through the gateway's server-side validation mechanism.
8. The backend verifies that the validated transaction matches the expected transaction identifier, amount, and currency.
9. The backend updates the purchase state and grants entitlement only when the transaction satisfies the required validation rules.
10. The frontend obtains updated purchase or entitlement information from the backend.

This sequence must be implemented as a server-validated workflow.

## 11.3 Success, Failure, and Cancellation

Browser return pages for successful, failed, or cancelled payments must not independently grant access.

The frontend may display a payment-status page, but any final status must be retrieved from the backend.

If payment validation is still pending, the interface should communicate that the payment is being verified rather than incorrectly reporting success.

## 11.4 Idempotency and Settlement

The backend must process repeated payment notifications safely.

The same transaction must not grant duplicate entitlements or create repeated settlement effects.

The documented design calls for atomic, idempotent settlement.

Transactions with a risk level that requires holding must not automatically grant entitlement until the applicable review or validation requirement is satisfied.

The current specification does not define a refund endpoint. The frontend must not expose a working refund action until the backend operation and its authorization rules are implemented.

---

# 12. File Uploads and Malware Scanning

## 12.1 Upload Requirements

The assignment-upload interface must submit files to the backend using multipart form data.

The backend must enforce file size, file type, field count, and other configured upload limits.

The system must validate consistency between the allowed extension, MIME type, and actual file signature. Unsupported file types, including SVG and executable files under the current security requirements, must be rejected.

Uploaded files must use generated storage keys. The original filename must not be trusted as a storage path.

The backend should calculate a SHA-256 hash for uploaded content where required by the implementation.

## 12.2 Private Object Storage

Cloudflare R2 must remain private by default.

The browser must never receive R2 access keys or secret credentials.

File access must be granted through an authenticated and authorized backend workflow.

Authorized download rules should follow the backend implementation, which specifies access for the file owner, the teacher responsible for the relevant assignment, or an administrator, as applicable.

## 12.3 Quarantine and Scan States

The upload system uses the following scan states:

- `pending_scan`
- `clean`
- `suspicious`
- `infected`
- `scan_failed`
- `disabled`

The frontend must communicate relevant file-processing states where the backend exposes them.

Only files that have passed the required security checks may be promoted to the normal file-storage area and made available for ordinary downloads.

Files that are pending, suspicious, infected, or associated with a failed scan must not be presented as approved downloads.

## 12.4 Malware-Scanning Failure

The backend must fail closed when the required malware scan cannot be completed.

A scan failure must not automatically be treated as a clean result.

The frontend must not provide a bypass that allows users to access quarantined or unapproved files.

The frontend may display a pending or failed processing state and provide an appropriate retry or support action when that behavior is supported by the backend.

## 12.5 Scan Status and Rescanning

The existing implementation notes describe upload rescan functionality through:

`POST /api/v1/uploads/:id/rescan`

However, this route is not included in the supplied OpenAPI object. It must be added to the formal API specification if it is intended to be supported.

A dedicated upload-status or scan-status polling endpoint is also not defined in the supplied OpenAPI object. The frontend must use the actual implemented contract rather than inventing a status endpoint.

---

# 13. Frontend State Management and API Integration

## 13.1 API Client

The frontend should use a centralized API client rather than duplicating server configuration and request behavior across components.

The client should manage:

- API base URL.
- Credential inclusion for session-based requests.
- JSON request and response handling.
- Multipart upload handling.
- Error interpretation.
- Consistent status-code handling.
- Request cancellation where appropriate.

The API base URL should come from frontend environment configuration.

## 13.2 Authentication State

The client-side authentication state should be initialized from the backend's current-user endpoint.

The frontend should not treat local storage as the authoritative source of user identity, role, or authorization.

After sign-in, sign-out, or a role-selection operation, the frontend must refresh or update the appropriate user state.

## 13.3 Data Fetching

Data must be fetched from the relevant backend endpoint.

The frontend must distinguish between server-provided data and temporary interface state.

For example, the frontend may temporarily store search input locally, but it must not claim that a video has been published or a purchase has succeeded before the backend confirms the operation.

Caching behavior must respect authentication and content permissions. Private user data must not leak between accounts due to inappropriate caching.

## 13.4 Form Validation

Client-side validation should improve usability but must not replace server-side validation.

The frontend should validate required fields and basic formats before submission.

Any additional constraints, file-size limits, or accepted values must follow the backend contract.

## 13.5 Environment Configuration

The frontend should use an environment variable such as:

`NEXT_PUBLIC_API_BASE_URL`

This variable is intended for the publicly accessible API base URL, not for secrets.

Do not place the following in frontend-exposed environment variables:

- Better Auth secrets.
- MongoDB credentials.
- SSLCOMMERZ private credentials.
- Cloudflare R2 access keys or secret keys.
- Bouncer API keys.

These secrets must remain in backend environment configuration.

---

# 14. Responsive Design and Accessibility

## 14.1 Responsive Behavior

The interface must adapt to desktop, tablet, and mobile viewports.

On desktop:

- The sidebar should remain available for efficient navigation.
- Dashboard content should make effective use of the available width.
- Data tables and content-management controls should remain readable.

On tablet:

- Navigation and secondary panels may use more compact layouts.
- Cards and form controls must retain comfortable spacing.

On mobile:

- The sidebar should collapse into appropriate mobile navigation.
- Forms must fit the viewport.
- Buttons and important actions must remain easy to reach.
- Video and question cards must remain readable.
- Tables should be adapted to compact layouts, card views, or controlled scrolling where necessary.

The interface must not depend on hover alone to reveal essential actions.

## 14.2 Accessibility

The frontend should:

- Use semantic HTML elements.
- Provide visible focus states.
- Support keyboard navigation.
- Associate labels with form controls.
- Display validation errors in a way that can be understood by assistive technologies.
- Use sufficient color contrast.
- Provide meaningful alternative text for relevant images.
- Avoid communicating status through color alone.
- Ensure modal dialogs and drawers can be navigated and dismissed appropriately.
- Respect reduced-motion preferences where animations are used.

Accessibility must be considered throughout implementation rather than added only after the visual design is complete.

---

# 15. Proposed Frontend Page Structure

The following structure is a recommended organization for the Next.js frontend. It is not a statement that these pages or routes already exist.

```text
app/
├── page.tsx
├── sign-in/
│   └── page.tsx
├── sign-up/
│   └── page.tsx
├── student/
│   ├── page.tsx
│   ├── my-learning/
│   │   └── page.tsx
│   ├── questions/
│   │   └── page.tsx
│   ├── my-exams/
│   │   └── page.tsx
│   ├── assignments/
│   │   └── page.tsx
│   ├── submissions/
│   │   └── page.tsx
│   ├── results/
│   │   └── page.tsx
│   ├── saved-content/
│   │   └── page.tsx
│   ├── purchases/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── teacher/
│   ├── page.tsx
│   ├── videos/
│   │   └── page.tsx
│   ├── playlists/
│   │   └── page.tsx
│   ├── questions/
│   │   └── page.tsx
│   ├── exams/
│   │   └── page.tsx
│   ├── students/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   ├── earnings/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── admin/
│   ├── page.tsx
│   └── users/
│       └── page.tsx
└── ...
```

The final route structure may differ if the project uses route groups, shared layouts, dynamic segments, or a different organizational convention. The important requirements are clear separation of public and authenticated experiences, reusable layouts, and consistent role-aware navigation.

---

# 16. Frontend and Backend Integration Gaps

The current API specification is a useful foundation, but it does not yet cover every interaction required by the finalized frontend.

The following gaps must be addressed before the relevant features can be treated as complete.

| Feature | Required API Capability | Current Status |
|---|---|---|
| Student question discovery | List, search, filter, and retrieve questions | Not defined in supplied OpenAPI |
| Teacher question management | Create, list, update, and delete questions as needed | Not defined in supplied OpenAPI |
| Question tags and highlighting | Search by title and tags; manage highlights if persistent | Not defined in supplied OpenAPI |
| Video details | Retrieve an individual video's details | Not defined in supplied OpenAPI |
| Video management | Edit, delete, publish, and other required operations | Not defined in supplied OpenAPI |
| Video playback | Authorize and deliver protected video content | Not defined in supplied OpenAPI |
| Playlists | Create and manage playlists | Not defined in supplied OpenAPI |
| Examination management | Teacher-facing examination CRUD and configuration | Not defined in supplied OpenAPI |
| Examination questions | Retrieve examination questions for an attempt | Not defined in supplied OpenAPI |
| Examination answers | Save answers and submit an attempt | Not defined in supplied OpenAPI |
| Examination results | Retrieve results and review information | Not defined in supplied OpenAPI |
| Assignment listing | Retrieve available assignments and instructions | Not defined in supplied OpenAPI |
| Submission history | List the student's submissions and statuses | Not defined in supplied OpenAPI |
| Grading and feedback | Provide authorized grading and feedback operations | Not defined in supplied OpenAPI |
| Saved content | Save, remove, and list saved resources | Not defined in supplied OpenAPI |
| Teacher following | Follow, unfollow, and list followed teachers | Not defined in supplied OpenAPI |
| Teacher analytics | Retrieve teacher-specific metrics | Not defined in supplied OpenAPI |
| Teacher earnings | Retrieve authorized financial summaries | Not defined in supplied OpenAPI |
| Upload status | Retrieve upload and malware-scan state | Not defined in supplied OpenAPI |
| Upload rescan | Rescan an uploaded file | Mentioned in implementation notes, not included in supplied OpenAPI |
| Refunds | Initiate and track authorized refunds | Not defined in supplied OpenAPI |

**Important:** “Not defined in supplied OpenAPI” does not necessarily mean that the functionality is absent from the backend code. It means that its availability and request/response contract cannot be established from the specification provided here. These routes must be checked against the actual implementation and documented before frontend integration.

The frontend must not assume an endpoint exists merely because a navigation item or design element requires it.

---

# 17. Security Requirements

The following security requirements apply to the complete system.

## 17.1 Authentication and Authorization

- Use Better Auth for session-based authentication.
- Require the appropriate authentication and verification state for protected features.
- Enforce user roles and resource ownership on the backend.
- Do not trust client-side role information.
- Do not allow public signup to create administrator accounts.
- Do not allow ordinary profile updates to change roles.
- Restrict administrative operations to authorized administrator accounts.

## 17.2 Payment Security

- Retrieve prices from trusted backend data.
- Validate gateway transactions server-side.
- Verify transaction identifiers, amounts, and currencies.
- Do not grant entitlements based solely on browser redirects.
- Process payment notifications idempotently.
- Keep payment secrets out of frontend code.

## 17.3 File Security

- Store uploaded files privately.
- Enforce upload limits and validate file signatures.
- Generate storage keys.
- Scan applicable uploads before normal access is granted.
- Keep failed or unsafe scans quarantined.
- Restrict file downloads according to ownership and authorization.
- Keep storage and scanning credentials on the backend.

## 17.4 Production Configuration

Before deployment:

- Configure production environment variables.
- Use HTTPS.
- Configure the correct frontend and backend origins.
- Configure Better Auth's production URL and trusted origins.
- Configure OAuth callback URLs where applicable.
- Configure MongoDB Atlas network access.
- Keep R2 private.
- Configure secure cookie behavior for the production topology.
- Configure SSLCOMMERZ production credentials and callback URLs as required.
- Ensure that the backend does not expose secrets through logs or responses.

---

# 18. Testing and Acceptance Criteria

## 18.1 Design Acceptance

The frontend design is accepted when:

- The green-and-white light theme follows the specified palette.
- The dark theme uses the specified black-and-charcoal direction.
- Student and teacher interfaces have distinct navigation and priorities.
- The teacher dashboard follows the finalized YouTube Studio-inspired direction.
- Question highlighting supports the intended card or drawer design.
- Student homepage question discovery appears above video recommendations.
- Common components use consistent spacing, typography, controls, and status indicators.
- Layouts adapt to desktop, tablet, and mobile screens.

## 18.2 Authentication Acceptance

- A student can register with an allowed role.
- A teacher can register with an allowed role.
- Public registration cannot create an admin account.
- Sign-in does not accept a role as an authorization decision.
- The frontend can retrieve the authenticated user's profile.
- Unauthenticated users cannot access protected functionality through the backend.
- Role selection follows the backend's one-time onboarding rules.

## 18.3 API Integration Acceptance

- The frontend uses the configured API base URL.
- Protected requests include credentials as required.
- Loading, success, empty, and error states are displayed appropriately.
- `401`, `403`, `409`, and validation responses are handled.
- The frontend uses real backend responses instead of invented successful results.
- Unimplemented backend operations are not represented as completed functionality.

## 18.4 Payment Acceptance

- A student can initiate an eligible purchase.
- The amount is determined by the backend.
- The frontend redirects using the gateway URL returned by the backend.
- Browser return URLs do not independently grant entitlement.
- The backend validates payment transactions before confirming purchase access.
- Repeated payment notifications do not create duplicate settlement effects or entitlements.

## 18.5 Upload Acceptance

- Unsupported files are rejected.
- The frontend reports upload failures clearly.
- Protected file access requires authorization.
- Files awaiting scanning are not represented as clean.
- Unsafe or failed scans are not made available as ordinary downloads.
- Private storage credentials are never exposed to the browser.

## 18.6 Overall Product Acceptance

LearnTest is ready for release when the implemented interfaces match the finalized design, all visible actions connect to supported backend functionality, security rules are enforced server-side, and the critical user journeys have been tested in the intended deployment environment.

---

# 19. Implementation Priorities

Implementation should proceed in the following order.

### Phase 1: Foundation

Establish the shared design system, responsive application shell, API client, authentication flows, current-user loading, error handling, and role-aware routing.

### Phase 2: Core Student Experience

Implement the student homepage structure, question-discovery interface, published-video listing, examination entry where supported, and profile access.

Question discovery and full examination participation must wait for the relevant APIs if those endpoints are not already implemented.

### Phase 3: Core Teacher Experience

Implement the teacher dashboard, video listing and creation supported by the backend, teacher profile, and the finalized question-management interface as its APIs become available.

### Phase 4: Assignments and Protected Content

Implement assignment upload, scan-status presentation where an API is available, purchase history, entitlement checks, and protected-content access.

### Phase 5: Payments

Implement SSLCOMMERZ initiation, gateway redirection, backend-verified purchase status, and entitlement refresh.

### Phase 6: Extended Management Features

Complete playlists, examination authoring and submission, results, saved content, teacher following, analytics, earnings, and related features as their backend contracts become available.

### Phase 7: Administration and Production Readiness

Complete the authorized administrative interface, production configuration, security verification, responsive testing, accessibility checks, and critical end-to-end tests.

---

# 20. Final Product Definition

LearnTest is an educational platform with three role-specific experiences built on a shared design system.

The **student experience** prioritizes question discovery, learning materials, examinations, assignments, results, saved content, and purchases.

The **teacher experience** uses a clean, YouTube Studio-inspired dashboard for managing videos, questions, examinations, students, and other teaching activities. It includes the finalized highlighted-question card or drawer with title and hashtag search as a required design interaction.

The **administrator experience** provides restricted administrative overview and user-role management.

The product uses a Next.js frontend, an Express.js and TypeScript API, MongoDB Atlas, Better Auth, SSLCOMMERZ, private Cloudflare R2 storage, and Bouncer malware scanning.

The backend is responsible for authentication, authorization, transaction validation, purchase entitlements, and file-safety decisions. The frontend is responsible for presenting these capabilities through a consistent, accessible, responsive, role-aware interface.

The supplied OpenAPI object defines the current documented API baseline. Features that require additional endpoints must be identified and implemented against explicit API contracts before they are considered complete.

**This specification is the shared product reference for frontend design, backend API integration, security requirements, and implementation acceptance.**
