# Affiliate Commerce OS: Phases 1 to 3

Phase 1 includes sign-in, the dashboard shell, the product research inbox, manual product entry, explainable scoring, Integrations (tracking IDs, extra social accounts, Pinterest boards), Compliance (disclosure wording), Settings, and Storefront collections. **Phase 3 adds** the Content Studio (free AI or no-AI drafts), a rules check on every package, the Approval Queue, and a Calendar with copy-ready posts and a "Mark posted" step.

## Updating from Phase 1 or 2 to Phase 3 (about 10 minutes)
1. **Supabase > SQL Editor:** paste and run the file `db/009_ai_usage_and_content_settings.sql` (safe to run twice).
2. **Free AI key:** go to console.groq.com/keys, sign up, create a key (Gemini at aistudio.google.com/apikey also works if Google allows your project).
3. **Netlify > Site configuration > Environment variables:** add `GROQ_API_KEY` = your key (or `GEMINI_API_KEY`) (do NOT tick any "expose to browser" option). Then **Deploys > Trigger deploy**.
4. Replace the files in your GitHub repo with the ones in this zip and push (Netlify rebuilds by itself).
5. In the app: Content Studio > tick an approved product > paste 2 to 4 facts from its listing > **Generate with AI**. Then Approval Queue > Approve > Schedule. At post time open Calendar, copy, post, tap **Mark posted**.

## Collages, product images and weekly top 5
- Run `db/010_product_images_and_collages.sql` in the Supabase SQL Editor (creates a private image bucket).
- **Product Images:** upload photos for approved products (tick the rights box). Images are stored privately and never copied from retailer sites.
- **Collages:** make your own board, or let the app build a "top 5" collage the first time you open it each week. Ranking uses your imported sales, then clicks, then opportunity score.
- **Collage style:** pick a title preset (or custom), a font and a color scheme, or your own brand colors, and save them as your default on the Collages page. The weekly collage uses your default. You can change a collage's look from its Edit page too.
- Uploads can remove a plain background automatically (works best on clean product shots).
- Images carry no disclosure text. The disclosure is the last line of every caption.

## Amazon Creators API (automatic product details and Discover)
Add `AMAZON_CREATORS_CLIENT_ID` and `AMAZON_CREATORS_CLIENT_SECRET` in Netlify (mark both secret) and redeploy. Then:
- **Add product:** paste an Amazon link and the name, price and your affiliate link are filled in.
- **Discover:** search Amazon, see price and sales rank, add good ones to the Research Inbox.
- **Products > Refresh Amazon prices:** re-checks prices (Amazon allows keeping prices up to 24 hours).
Product images from this API are not used: Amazon does not allow storing them or using them in social posts.

Without a key the **Quick draft (no AI)** button still works.

The free Gemini tier is rate limited (Google shows your exact limits in AI Studio) and Google may use free-tier prompts to improve its products, so the app only sends product names and the facts you type. If you ever see "model not recognised", change `ai.model` in Settings.

**Posting is manual-assist for now:** approved posts appear on the Calendar ready to copy. Automatic posting needs Instagram's API (needs a Facebook Page, which you can add any time), TikTok app review, and Pinterest Standard access.

**Status:** the scoring and URL logic passed 12 automated tests. The full app has not been built or run yet (the build environment could not reach the npm registry). Your first `npm run build` may show a small error; paste it back and it gets fixed in one pass.

## One-time setup (about 20 minutes)

### 1. Create the free database (Supabase)
1. Go to supabase.com, create a free account, and create a new project. Save the database password somewhere safe.
2. Open **SQL Editor > New query**, paste the entire contents of `affiliate_os_migrations_001-008.sql`, and click **Run**. It should finish with no error. (If it errors, copy the message back.)
3. Open **Project Settings > API** and copy the **Project URL** and the **anon / publishable key**.

### 2. Run the app on your computer (needs Node.js 20 or newer)
```
cd app
cp .env.example .env.local        # then paste the two Supabase values into .env.local
npm install
npm test                          # should pass 12 tests
npm run build                     # should finish with no errors
npm run dev                       # open http://localhost:3000
```
Create your account on the login page, then fill in the one-time workspace form. Your Pinterest board "Mallory Lumpkin - Fav Products" is prefilled.

### 3. Lock sign-ups
In Supabase: **Authentication > Sign In / Providers**, turn off "Allow new users to sign up" once you have created your account.

### 4. Put it online for free (Netlify)
1. Put the `app` folder in a GitHub repository (private is fine).
2. At netlify.com, choose **Add new site > Import from Git**, pick the repository. Netlify detects Next.js automatically.
3. Under **Site configuration > Environment variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. In Supabase **Authentication > URL Configuration**, set the Site URL to your Netlify address.

Hosting note: Vercel's free plan is not allowed for commercial use. Netlify's free plan shows hard monthly limits and its Terms of Use do not restrict commercial use, but I did not read its Acceptable Use Policy, so check that page once before relying on it. The app is plain Next.js and can move to another host later.

## First things to do in the app
1. **Integrations:** enter your TikTok handle, your Amazon tracking ID for each of Instagram, TikTok and Pinterest, and tick each channel you registered in Associates Central.
2. **Compliance:** review the draft disclosure wording against Amazon's and each platform's current rules, edit it, and activate it.
3. **Products > Add product:** paste a product link, type the price and rating you see, optionally paste your own affiliate link, then score it in the Research Inbox.
4. Optional: **Settings > Add synthetic test products** to practice (they are labeled and cannot be published).

## Safety built in
- Passwords are never stored for any retailer or social account. Only tracking IDs and your own pasted affiliate links are.
- The app never opens or scrapes retailer pages; it reads only the link you paste. Short links (a.co, amzn.to) are refused.
- Amazon links without your tracking ID (`tag=`) are refused.
- Missing data is stored as missing, never as zero, and lowers the score's confidence.
- Anything marked synthetic is blocked from publishing, and the database refuses to schedule a post that is unapproved, has no active disclosure, has unclear media rights, or contains a child.
