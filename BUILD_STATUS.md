# Next booking upgrade — agreed requirements

Implement before asking user for another Supabase action:

1. Bilingual English/Gujarati labels throughout booking UI.
2. Booking fields: date picker; name; mobile limited to 10 digits; 12-hour scrollable 15-minute time selector; people; selectable place; receipt number; Rasoi Seva; Thakorji Seva; menu.
3. Final total is **only** Rasoi Seva + Thakorji Seva. Menu prices and food amount are never visible to Counter or customer.
4. Breakfast/Lunch/Dinner menu tabs; Counter sees item names only.
5. Admin can add, edit, deactivate/remove places and menu items; menu item has meal period and price.
6. Admin can add/edit/deactivate custom booking fields (text, number, date, yes/no, select), no code changes required for future fields.
7. Save Booking at bottom. Store by service date and receipt number. Admin sees booking status.
8. Prevent any non-cancelled booking sharing identical date + place + 15-minute time.

## Existing work

- `BOOKING_V2_SETUP.sql` contains backend migration: master tables, custom-field table, RPC that securely calculates final total, price-hidden view, and unique booking constraint.
- `App.tsx` is still the older booking form and must be upgraded to use that migration before packaging.
- `package.json` now includes `@react-native-community/datetimepicker`; run `npm install` before TypeScript checking.
