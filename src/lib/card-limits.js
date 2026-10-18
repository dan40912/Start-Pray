// Length limits for HomePrayerCard text, shared by the create/edit forms and
// the API routes so the textarea stops where the server would.
// `description` is a TEXT column (see the 20261018000100 migration); the limit
// here is the product limit, well under what the column can hold.
export const MAX_CARD_TITLE_LENGTH = 120;
export const MAX_CARD_DESCRIPTION_LENGTH = 3000;
