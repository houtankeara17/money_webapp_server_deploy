/**
 * Server-side API messages (EN + KM)
 */

const { normalizeLang, DEFAULT_LANG } = require("../middleware/language");

const messages = {
  en: {
    unauthorized: "Not authorized",
    "auth.registerRequired": "Please provide name, email and password",
    "auth.exists": "User already exists with this email",
    "auth.invalidData": "Invalid user data",
    "auth.registerOk": "Registration successful! Welcome to MoneyFlow.",
    "auth.loginRequired": "Please provide email and password",
    "auth.loginOk": "Login successful! Welcome back.",
    "auth.invalidCredentials": "Invalid email or password",
    "auth.refreshRequired": "Refresh token is required",
    "auth.refreshInvalid": "Invalid or expired refresh token",
    "auth.userNotFound": "User not found",
    "auth.refreshRevoked": "Refresh token revoked — please login again",
    "auth.refreshExpired": "Refresh token expired — please login again",
    "auth.refreshMismatch": "Refresh token mismatch — please login again",
    "auth.tokenRefreshed": "Token refreshed",
    "auth.logoutOk": "Logged out successfully",
    "auth.profileOk": "User profile retrieved",
    "auth.profileUpdated": "Profile updated successfully",
    "auth.passwordRequired": "Current and new password are required",
    "auth.passwordShort": "Password must be at least 6 characters",
    "auth.passwordWrong": "Current password is incorrect",
    "auth.passwordUpdated": "Password updated successfully",
    "auth.emailRequired": "Email is required",
    "auth.resetSent": "If that email exists, a reset code has been sent",
    "auth.resetCodeRequired": "Reset code is required",
    "auth.resetInvalid": "Invalid or expired reset code",
    "auth.resetOk": "Password reset successful. You can now login.",
    "auth.tokenExpired": "Access token expired — use POST /auth/refresh",
    "auth.tokenFailed": "Not authorized, token failed",
    "auth.noToken":
      "Not authorized, no token. Login first and send Authorization: Bearer <accessToken>",
    "crud.created": "Created successfully",
    "crud.updated": "Updated successfully",
    "crud.deleted": "Deleted successfully",
    "crud.duplicated": "Duplicated successfully",
    "crud.deleteAll": "Deleted all records",
    "crud.notFound": "Record not found",

    // --- Expense Translations ---
    "expense.created": "Expense added successfully",
    "expense.updated": "Expense updated successfully",
    "expense.deleted": "Expense deleted successfully",
    "expense.duplicated": "Expense duplicated successfully",
    "expense.allDeleted": "Successfully deleted all expenses",
    "expense.notFound": "Expense not found",
    "expense.requiredFields": "Missing required fields",
    "expense.exportReady": "Expenses exported successfully",
    "expense.importNoData": "No data provided for import",
    "expense.importedSuccess": "{count} expense entries imported successfully",

    // --- Exchange Log Translations ---
    "exchange.created": "Exchange log added successfully",
    "exchange.updated": "Exchange log updated successfully",
    "exchange.deleted": "Successfully deleted exchange log",
    "exchange.duplicated": "Exchange log duplicated successfully",
    "exchange.allDeleted": "Successfully deleted all exchange logs",
    "exchange.notFound": "Exchange log not found",
    "exchange.requiredFields":
      "From/to currencies, amounts, rate and provider are required",
    "exchange.sameCurrency": "From and to currencies must be different",
    "exchange.exportReady": "Export ready",
    "exchange.importNoData": "No data provided for import",
    "exchange.importNoRowsFound":
      "No valid exchange logs found in imported file",
    "exchange.importedSuccess":
      "{count} exchange log entries imported successfully",

    // --- Bonus Translations ---
    "bonus.created": "Bonus added successfully",
    "bonus.updated": "Bonus updated — linked salary adjusted",
    "bonus.deleted": "Bonus deleted — salary restored",
    "bonus.duplicated": "Bonus duplicated successfully",
    "bonus.createdLinked": "Bonus added — linked salary updated",
    "bonus.createdNoSalary":
      "Bonus added successfully (no salary for this month)",
    "bonus.notFound": "Bonus not found",
    "bonus.requiredFields":
      "Amount, currency, year, month and tag are required",
    "bonus.invalidMonth": "Invalid month number",
    "bonus.allDeleted": "Successfully deleted all bonuses",
    "bonus.exportReady": "Export ready",
    "bonus.importNoData": "No data provided for import",
    "bonus.importedSuccess": "{count} items imported successfully",

    // --- Budget Translations ---
    "budget.created": "Budget created successfully",
    "budget.updated": "Budget updated successfully",
    "budget.deleted": "Budget deleted successfully",
    "budget.duplicated": "Budget duplicated successfully",
    "budget.exists": "Budget for this month already exists — edit it instead",
    "budget.allDeleted": "Successfully deleted all budgets",
    "budget.notFound": "Budget not found",
    "budget.requiredFields": "Year and month are required",
    "budget.invalidMonth": "Invalid month number",
    "budget.exportReady": "Budgets exported successfully",
    "budget.importNoData": "No data provided for import",
    "budget.importedSuccess": "{count} budget entries imported successfully",

    // --- Loan Translations ---
    "loan.created": "Loan created successfully",
    "loan.updated": "Loan updated successfully",
    "loan.deleted": "Loan deleted successfully",
    "loan.repaid": "Repayment recorded",
    "loan.notFound": "Loan not found",
    "loan.requiredFields": "Person and amount are required",
    "loan.invalidDirection": "Direction must be lent or borrowed",
    "loan.invalidAmount": "Amount must be a positive number",
    "loan.cannotRepay": "Cannot repay a paid or cancelled loan",
    "loan.invalidRepayAmount": "Repayment amount must be positive",
    "loan.allDeleted": "Successfully deleted all loans",
    "loan.exportReady": "Loans fetched for export",
    "loan.importNoItems": "No valid loan data provided in 'items' array.",
    "loan.importNoRowsFound":
      "No valid rows found in file. Ensure 'Person' and 'Amount' columns are populated.",
    "loan.importedSuccess": "{count} loans imported successfully",

    // --- Note Translations ---
    "note.created": "Note created successfully",
    "note.updated": "Note updated successfully",
    "note.deleted": "Note deleted successfully",
    "note.duplicated": "Note duplicated successfully",
    "note.allDeleted": "Successfully deleted all notes",
    "note.pinned": "Note pinned",
    "note.unpinned": "Note unpinned",
    "note.titleRequired": "Title is required",
    "note.exported": "Notes exported",
    "note.notFound": "Note not found",
    "note.checklistItemNotFound": "Checklist item not found",
    "note.checklistUpdated": "Checklist updated",
    "note.importNoText": "No valid text content provided for import.",
    "note.importNoNotesFound": "No valid notes found to import.",
    "note.importedSuccess": "{count} notes imported successfully",

    // --- Plan Translations ---
    "plan.created": "Plan created successfully",
    "plan.updated": "Plan updated successfully",
    "plan.deleted": "Plan deleted successfully",
    "plan.duplicated": "Plan duplicated successfully",
    "plan.allDeleted": "Successfully deleted all plans",
    "plan.notFound": "Plan not found",
    "plan.exportReady": "Plans exported successfully",
    "plan.returnAdded": "Investment return recorded successfully",
    "plan.importNoData": "No data provided for import",
    "plan.importNoRowsFound":
      "No valid rows found in file. Ensure 'Title' and 'Target Amount' columns are populated.",
    "plan.importedSuccess": "{count} plans imported successfully",

    // --- Remittance Translations ---
    "remittance.created": "Remittance added successfully",
    "remittance.updated": "Remittance updated successfully",
    "remittance.deleted": "Remittance deleted successfully",
    "remittance.duplicated": "Remittance duplicated successfully",
    "remittance.allDeleted": "Successfully deleted all remittances",
    "remittance.exportReady": "Export ready",
    "remittance.notFound": "Remittance record not found",
    "remittance.validationRequired":
      "Amount, currency, recipient and payment method are required",
    "remittance.importNoItems":
      "No valid remittance data provided in 'items' array.",
    "remittance.importNoRowsFound":
      "No valid rows found in file. Ensure 'Amount' and 'Recipient' columns are populated.",
    "remittance.importedSuccess": "remittances imported successfully",

    // --- Salary Translations ---
    "salary.created": "Salary added successfully",
    "salary.updated": "Salary updated successfully",
    "salary.deleted": "Salary deleted successfully",
    "salary.duplicated": "Salary duplicated successfully",
    "salary.allDeleted": "Successfully deleted all salaries",
    "salary.notFound": "Salary record not found",
    "salary.validationRequired":
      "Amount, currency, year and month are required",
    "salary.invalidMonth": "Invalid month number",
    "salary.importNoItems": "No valid salary data provided in 'items' array.",
    "salary.importNoRowsFound":
      "No rows matched required fields (Year, MonthNumber, Amount).",
    "salary.importedSuccess": "salary records imported successfully",

    // --- Saving Translations ---
    "saving.created": "Saving added successfully",
    "saving.updated": "Saving updated successfully",
    "saving.deleted": "Saving deleted successfully",
    "saving.duplicated": "Saving duplicated successfully",
    "saving.allDeleted": "Successfully deleted all savings",
    "saving.exportReady": "Savings exported successfully",
    "saving.notFound": "Saving record not found",
    "saving.validationRequired": "Amount, currency and category are required",
    "saving.invalidMonth": "Invalid month number",
    "saving.importNoItems": "No valid savings data provided in 'items' array.",
    "saving.importNoRowsFound": "No valid rows found in file.",
    "saving.importedSuccess": "savings records imported successfully",
  },
  km: {
    unauthorized: "មិនមានសិទ្ធិ",
    "auth.registerRequired": "សូមបញ្ចូលឈ្មោះ អ៊ីមែល និងពាក្យសម្ងាត់",
    "auth.exists": "អ្នកប្រើប្រាស់មានរួចហើយជាមួយអ៊ីមែលនេះ",
    "auth.invalidData": "ទិន្នន័យអ្នកប្រើមិនត្រឹមត្រូវ",
    "auth.registerOk": "ចុះឈ្មោះជោគជ័យ! សូមស្វាគមន៍មកកាន់ MoneyFlow។",
    "auth.loginRequired": "សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់",
    "auth.loginOk": "ចូលដោយជោគជ័យ! សូមស្វាគមន៍ការត្រឡប់មកវិញ។",
    "auth.invalidCredentials": "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ",
    "auth.refreshRequired": "ត្រូវការផ្តល់ refresh token",
    "auth.refreshInvalid": "Refresh token មិនត្រឹមត្រូវ ឬផុតកំណត់",
    "auth.userNotFound": "រកមិនឃើញអ្នកប្រើ",
    "auth.refreshRevoked": "Refresh token ត្រូវបានលុប — សូមចូលម្តងទៀត",
    "auth.refreshExpired": "Refresh token ផុតកំណត់ — សូមចូលម្តងទៀត",
    "auth.refreshMismatch": "Refresh token មិនត្រូវគ្នា — សូមចូលម្តងទៀត",
    "auth.tokenRefreshed": "បានធ្វើបច្ចុប្បន្នភាព token",
    "auth.logoutOk": "ចាកចេញដោយជោគជ័យ",
    "auth.profileOk": "បានទាញយកប្រវត្តិរូប",
    "auth.profileUpdated": "បានធ្វើបច្ចុប្បន្នភាពប្រវត្តិរូប",
    "auth.passwordRequired": "ត្រូវការពាក្យសម្ងាត់បច្ចុប្បន្ន និងថ្មី",
    "auth.passwordShort": "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ តួ",
    "auth.passwordWrong": "ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ",
    "auth.passwordUpdated": "បានធ្វើបច្ចុប្បន្នភាពពាក្យសម្ងាត់",
    "auth.emailRequired": "ត្រូវការអ៊ីមែល",
    "auth.resetSent": "ប្រសិនបើអ៊ីមែលមាន លេខកូដកំណត់ឡើងវិញត្រូវបានផ្ញើ",
    "auth.resetCodeRequired": "ត្រូវការលេខកូដកំណត់ឡើងវិញ",
    "auth.resetInvalid": "លេខកូដមិនត្រឹមត្រូវ ឬផុតកំណត់",
    "auth.resetOk": "កំណត់ពាក្យសម្ងាត់ឡើងវិញជោគជ័យ។ អ្នកអាចចូលបានហើយ។",
    "auth.tokenExpired": "Access token ផុតកំណត់ — ប្រើ POST /auth/refresh",
    "auth.tokenFailed": "មិនមានសិទ្ធិ សញ្ញាសម្ងាត់បរាជ័យ",
    "auth.noToken":
      "មិនមានសិទ្ធិ មិនមាន token។ សូមចូល ហើយផ្ញើ Authorization: Bearer <accessToken>",
    "crud.created": "បានបង្កើតដោយជោគជ័យ",
    "crud.updated": "បានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ",
    "crud.deleted": "បានលុបដោយជោគជ័យ",
    "crud.duplicated": "បានចម្លងដោយជោគជ័យ",
    "crud.deleteAll": "បានលុបកំណត់ត្រាទាំងអស់",
    "crud.notFound": "រកមិនឃើញកំណត់ត្រា",

    // --- Expense Translations ---
    "expense.created": "បានបន្ថែមចំណាយដោយជោគជ័យ",
    "expense.updated": "បានធ្វើបច្ចុប្បន្នភាពចំណាយ",
    "expense.deleted": "បានលុបចំណាយដោយជោគជ័យ",
    "expense.duplicated": "បានចម្លងចំណាយដោយជោគជ័យ",
    "expense.allDeleted": "បានលុបចំណាយទាំងអស់ដោយជោគជ័យ",
    "expense.notFound": "រកមិនឃើញចំណាយ",
    "expense.requiredFields": "សូមបញ្ចូលព័ត៌មានចាំបាច់ឲ្យបានគ្រប់គ្រាន់",
    "expense.exportReady": "ទិន្នន័យចំណាយបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "expense.importNoData": "គ្មានទិន្នន័យត្រូវបានផ្តល់ជូនសម្រាប់ការនាំចូលទេ",
    "expense.importedSuccess": "បាននាំចូលចំណាយចំនួន {count} ដោយជោគជ័យ",

    // --- Exchange Log Translations ---
    "exchange.created": "បានបន្ថែមកំណត់ត្រាប្តូរប្រាក់ដោយជោគជ័យ",
    "exchange.updated": "បានធ្វើបច្ចុប្បន្នភាពកំណត់ត្រាប្តូរប្រាក់",
    "exchange.deleted": "បានលុបកំណត់ត្រាប្តូរប្រាក់ដោយជោគជ័យ",
    "exchange.duplicated": "បានចម្លងកំណត់ត្រាប្តូរប្រាក់ដោយជោគជ័យ",
    "exchange.allDeleted": "បានលុបកំណត់ត្រាប្តូរប្រាក់ទាំងអស់ដោយជោគជ័យ",
    "exchange.notFound": "រកមិនឃើញកំណត់ត្រាប្តូរប្រាក់",
    "exchange.requiredFields":
      "តម្រូវឲ្យមានរូបិយប័ណ្ណដើម/គោលដៅ ចំនួនទឹកប្រាក់ អត្រាប្តូរប្រាក់ និងអ្នកផ្តល់សេវា",
    "exchange.sameCurrency": "រូបិយប័ណ្ណដើម និងគោលដៅត្រូវតែខុសគ្នា",
    "exchange.exportReady": "ទិន្នន័យបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "exchange.importNoData": "គ្មានទិន្នន័យត្រូវបានផ្តល់ជូនសម្រាប់ការនាំចូលទេ",
    "exchange.importNoRowsFound":
      "រកមិនឃើញកំណត់ត្រាប្តូរប្រាក់ត្រឹមត្រូវក្នុងឯកសារនាំចូលទេ",
    "exchange.importedSuccess":
      "បាននាំចូលកំណត់ត្រាប្តូរប្រាក់ចំនួន {count} ដោយជោគជ័យ",

    // --- Bonus Translations ---
    "bonus.created": "បានបន្ថែមប្រាក់រង្វាន់ដោយជោគជ័យ",
    "bonus.updated": "បានធ្វើបច្ចុប្បន្នភាពប្រាក់រង្វាន់ — ប្រាក់ខែត្រូវបានកែ",
    "bonus.deleted": "បានលុបប្រាក់រង្វាន់ — ប្រាក់ខែត្រូវបានស្តារ",
    "bonus.duplicated": "បានចម្លងប្រាក់រង្វាន់ដោយជោគជ័យ",
    "bonus.createdLinked": "បានបន្ថែមប្រាក់រង្វាន់ — ប្រាក់ខែភ្ជាប់ត្រូវបានកែ",
    "bonus.createdNoSalary":
      "បានបន្ថែមប្រាក់រង្វាន់ (គ្មានប្រាក់ខែសម្រាប់ខែនេះ)",
    "bonus.notFound": "រកមិនឃើញប្រាក់រង្វាន់",
    "bonus.requiredFields":
      "តម្រូវឲ្យមានចំនួនទឹកប្រាក់ រូបិយប័ណ្ណ ឆ្នាំ ខែ និងស្លាក (Tag)",
    "bonus.invalidMonth": "លេខខែមិនត្រឹមត្រូវ",
    "bonus.allDeleted": "បានលុបប្រាក់រង្វាន់ទាំងអស់ដោយជោគជ័យ",
    "bonus.exportReady": "ទិន្នន័យបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "bonus.importNoData": "គ្មានទិន្នន័យត្រូវបានផ្តល់ជូនសម្រាប់ការនាំចូលទេ",
    "bonus.importedSuccess": "បាននាំចូលប្រាក់រង្វាន់ចំនួន {count} ដោយជោគជ័យ",

    // --- Budget Translations ---
    "budget.created": "បានបង្កើតថវិកាដោយជោគជ័យ",
    "budget.updated": "បានធ្វើបច្ចុប្បន្នភាពថវិកា",
    "budget.deleted": "បានលុបថវិកាដោយជោគជ័យ",
    "budget.duplicated": "បានចម្លងថវិកាដោយជោគជ័យ",
    "budget.exists": "ថវិកាសម្រាប់ខែនេះមានរួចហើយ — សូមកែជំនួស",
    "budget.allDeleted": "បានលុបថវិកាទាំងអស់ដោយជោគជ័យ",
    "budget.notFound": "រកមិនឃើញថវិកា",
    "budget.requiredFields": "តម្រូវឲ្យមានឆ្នាំ និងខែ",
    "budget.invalidMonth": "លេខខែមិនត្រឹមត្រូវ",
    "budget.exportReady": "ទិន្នន័យថវិកាបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "budget.importNoData": "គ្មានទិន្នន័យត្រូវបានផ្តល់ជូនសម្រាប់ការនាំចូលទេ",
    "budget.importedSuccess": "បាននាំចូលថវិកាចំនួន {count} ដោយជោគជ័យ",

    // --- Loan Translations ---
    "loan.created": "បានបង្កើតបំណុល/ខ្ចីដោយជោគជ័យ",
    "loan.updated": "បានធ្វើបច្ចុប្បន្នភាពបំណុល",
    "loan.deleted": "បានលុបបំណុលដោយជោគជ័យ",
    "loan.repaid": "បានកត់ត្រាការសង",
    "loan.notFound": "រកមិនឃើញបំណុល",
    "loan.requiredFields": "តម្រូវឲ្យមានឈ្មោះបុគ្គល និងចំនួនទឹកប្រាក់",
    "loan.invalidDirection":
      "ទិសដៅត្រូវតែជា ឲ្យគេខ្ចី (lent) ឬ ខ្ចីគេ (borrowed)",
    "loan.invalidAmount": "ចំនួនទឹកប្រាក់ត្រូវតែជាចំនួនវិជ្ជមាន",
    "loan.cannotRepay": "មិនអាចសងបំណុលដែលបានបង់រួច ឬបោះបង់បានទេ",
    "loan.invalidRepayAmount": "ចំនួនទឹកប្រាក់សងត្រូវតែជាចំនួនវិជ្ជមាន",
    "loan.allDeleted": "បានលុបបំណុលទាំងអស់ដោយជោគជ័យ",
    "loan.exportReady": "ទិន្នន័យបំណុលបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "loan.importNoItems":
      "គ្មានទិន្នន័យបំណុលត្រឹមត្រូវនៅក្នុង 'items' ត្រូវបានផ្តល់ជូនទេ",
    "loan.importNoRowsFound":
      "រកមិនឃើញជួរដេកត្រឹមត្រូវក្នុងឯកសារទេ។ សូមប្រាកដថាជួរឈរ 'Person' និង 'Amount' មានទិន្នន័យ",
    "loan.importedSuccess": "បាននាំចូលបំណុលចំនួន {count} ដោយជោគជ័យ",

    // --- Note Translations ---
    "note.created": "បានបង្កើតកំណត់ចំណាំ",
    "note.updated": "បានធ្វើបច្ចុប្បន្នភាពកំណត់ចំណាំ",
    "note.deleted": "បានលុបកំណត់ចំណាំ",
    "note.duplicated": "បានចម្លងកំណត់ចំណាំដោយជោគជ័យ",
    "note.allDeleted": "បានលុបកំណត់ចំណាំទាំងអស់ដោយជោគជ័យ",
    "note.pinned": "បានខ្ទាស់កំណត់ចំណាំ",
    "note.unpinned": "បានដោះការខ្ទាស់កំណត់ចំណាំ",
    "note.titleRequired": "តម្រូវឲ្យមានចំណងជើង",
    "note.exported": "បាននាំចេញកំណត់ចំណាំ",
    "note.notFound": "រកមិនឃើញកំណត់ចំណាំ",
    "note.checklistItemNotFound": "រកមិនឃើញធាតុបញ្ជីពិនិត្យ",
    "note.checklistUpdated": "បានធ្វើបច្ចុប្បន្នភាពបញ្ជីពិនិត្យ",
    "note.importNoText": "គ្មានខ្លឹមសារអត្ថបទត្រឹមត្រូវសម្រាប់នាំចូលទេ",
    "note.importNoNotesFound": "រកមិនឃើញកំណត់ចំណាំត្រឹមត្រូវដើម្បីនាំចូលទេ",
    "note.importedSuccess": "បាននាំចូលកំណត់ចំណាំចំនួន {count} ដោយជោគជ័យ",

    // --- Plan Translations ---
    "plan.created": "បានបង្កើតគោលដៅដោយជោគជ័យ",
    "plan.updated": "បានធ្វើបច្ចុប្បន្នភាពគោលដៅ",
    "plan.deleted": "បានលុបគោលដៅ",
    "plan.duplicated": "បានចម្លងគោលដៅដោយជោគជ័យ",
    "plan.allDeleted": "បានលុបគម្រោងទាំងអស់ដោយជោគជ័យ",
    "plan.notFound": "រកមិនឃើញគោលដៅទេ",
    "plan.exportReady": "ទិន្នន័យគោលដៅបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "plan.returnAdded": "បានកត់ត្រាផលចំណេញពីការវិនិយោគដោយជោគជ័យ",
    "plan.importNoData": "គ្មានទិន្នន័យត្រូវបានផ្តល់ជូនសម្រាប់ការនាំចូលទេ",
    "plan.importNoRowsFound":
      "រកមិនឃើញជួរដេកត្រឹមត្រូវក្នុងឯកសារទេ។ សូមប្រាកដថាជួរឈរ 'Title' និង 'Target Amount' មានទិន្នន័យ",
    "plan.importedSuccess": "បាននាំចូលគោលដៅចំនួន {count} ដោយជោគជ័យ",

    // --- Remittance Translations ---
    "remittance.created": "បានបន្ថែមការផ្ញើប្រាក់ដោយជោគជ័យ",
    "remittance.updated": "បានធ្វើបច្ចុប្បន្នភាពការផ្ញើប្រាក់",
    "remittance.deleted": "បានលុបការផ្ញើប្រាក់",
    "remittance.duplicated": "បានចម្លងការផ្ញើប្រាក់ដោយជោគជ័យ",
    "remittance.allDeleted": "បានលុបការផ្ញើប្រាក់ទាំងអស់ដោយជោគជ័យ",
    "remittance.exportReady": "ទិន្នន័យបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "remittance.notFound": "រកមិនឃើញកំណត់ត្រាការផ្ញើប្រាក់",
    "remittance.validationRequired":
      "តម្រូវឲ្យមានចំនួនទឹកប្រាក់ រូបិយប័ណ្ណ អ្នកទទួល និងវិធីសាស្ត្រទូទាត់",
    "remittance.importNoItems":
      "គ្មានទិន្នន័យការផ្ញើប្រាក់ត្រឹមត្រូវនៅក្នុង 'items' ត្រូវបានផ្តល់ជូនទេ",
    "remittance.importNoRowsFound":
      "រកមិនឃើញជួរដេកត្រឹមត្រូវក្នុងឯកសារទេ។ សូមប្រាកដថាជួរឈរ 'Amount' និង 'Recipient' មានទិន្នន័យ",
    "remittance.importedSuccess": "បាននាំចូលការផ្ញើប្រាក់ដោយជោគជ័យ",

    // --- Salary Translations ---
    "salary.created": "បានបន្ថែមប្រាក់ខែដោយជោគជ័យ",
    "salary.updated": "បានធ្វើបច្ចុប្បន្នភាពប្រាក់ខែ",
    "salary.deleted": "បានលុបប្រាក់ខែ",
    "salary.duplicated": "បានចម្លងប្រាក់ខែដោយជោគជ័យ",
    "salary.allDeleted": "បានលុបប្រាក់ខែទាំងអស់ដោយជោគជ័យ",
    "salary.notFound": "រកមិនឃើញកំណត់ត្រាប្រាក់ខែ",
    "salary.validationRequired":
      "តម្រូវឲ្យមានចំនួនទឹកប្រាក់ រូបិយប័ណ្ណ ឆ្នាំ និងខែ",
    "salary.invalidMonth": "លេខខែមិនត្រឹមត្រូវ",
    "salary.importNoItems":
      "គ្មានទិន្នន័យប្រាក់ខែត្រឹមត្រូវនៅក្នុង 'items' ត្រូវបានផ្តល់ជូនទេ",
    "salary.importNoRowsFound":
      "គ្មានជួរដេកដែលត្រូវគ្នានឹងវាលដែលត្រូវការទេ (ឆ្នាំ, លេខខែ, ចំនួនទឹកប្រាក់)។",
    "salary.importedSuccess": "បាននាំចូលប្រាក់ខែដោយជោគជ័យ",

    // --- Saving Translations ---
    "saving.created": "បានបន្ថែមសន្សំដោយជោគជ័យ",
    "saving.updated": "បានធ្វើបច្ចុប្បន្នភាពសន្សំ",
    "saving.deleted": "បានលុបសន្សំ",
    "saving.duplicated": "បានចម្លងសន្សំដោយជោគជ័យ",
    "saving.allDeleted": "បានលុបសន្សំទាំងអស់ដោយជោគជ័យ",
    "saving.exportReady": "ទិន្នន័យសន្សំបានរៀបចំរួចរាល់សម្រាប់ការនាំចេញ",
    "saving.notFound": "រកមិនឃើញកំណត់ត្រាសន្សំ",
    "saving.validationRequired":
      "តម្រូវឲ្យមានចំនួនទឹកប្រាក់ រូបិយប័ណ្ណ និងប្រភេទ",
    "saving.invalidMonth": "លេខខែមិនត្រឹមត្រូវ",
    "saving.importNoItems":
      "គ្មានទិន្នន័យសន្សំត្រឹមត្រូវនៅក្នុង 'items' ត្រូវបានផ្តល់ជូនទេ",
    "saving.importNoRowsFound": "រកមិនឃើញជួរដេកត្រឹមត្រូវក្នុងឯកសារទេ",
    "saving.importedSuccess": "បាននាំចូលសន្សំដោយជោគជ័យ",
  },
};

function getLang(req) {
  if (!req) return DEFAULT_LANG;
  if (req.lang === "km" || req.lang === "en") return req.lang;
  const fromX = normalizeLang(req.headers?.["x-language"]);
  if (fromX) return fromX;
  const fromUser = normalizeLang(req.user?.language);
  if (fromUser) return fromUser;
  return DEFAULT_LANG;
}

function t(key, lang = "en", params = {}) {
  const L = lang === "km" ? "km" : "en";
  let template = messages[L][key] || messages.en[key] || key;

  // Replace placeholders like {count}
  Object.keys(params).forEach((p) => {
    template = template.replace(new RegExp(`\\{${p}\\}`, "g"), params[p]);
  });

  return template;
}

function msg(req, key, params = {}) {
  return t(key, getLang(req), params);
}

module.exports = { messages, getLang, t, msg, normalizeLang };
