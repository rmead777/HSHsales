# Mobile QA Checklist

Use this before demoing the production PWA on real phones.

## Devices

- iPhone with notch: install from `https://hs-hsales.vercel.app`.
- iPhone SE or similarly small viewport.
- Android Chrome.

## Core Rep Flow

- Sign in as an active rep.
- Open Home, Checkout, and QR Codes from the bottom nav.
- Confirm no text or buttons sit under the home indicator.
- Confirm all inputs focus without iOS zooming the page.
- On QR Codes, switch products, copy a link, share a link, and download/scan a QR.
- Confirm copied checkout URLs include `client_reference_id=<rep_code>`.

## Admin Flow

- Open Admin from the bottom nav.
- Swipe the admin tab row horizontally on a narrow phone.
- Open Links, Products, News, Reps, and Sales.
- Open add/edit sheets, focus each field, save, and close.
- Confirm switches and reorder controls can be tapped comfortably with a thumb.

## Stripe Smoke

- Complete a Stripe test checkout from an attributed product link.
- Confirm the sale appears in Admin -> Sales with the rep code.

## Native-Feel Checks

- Use one hand only; note any re-grips.
- Confirm sheet scroll does not drag the page behind it.
- Confirm tap feedback feels immediate.
- Enable reduced motion at the OS level and confirm the app remains usable.
