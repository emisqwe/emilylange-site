# emilylange.com

A hand-built portfolio site. Free hosting on Cloudflare Pages, and the domain stays registered at GoDaddy. You edit it through Pages CMS, a free visual editor, with no code required.

**How it fits together**

- **GitHub** stores the site's files.
- **Pages CMS** is the editor. It saves your changes into GitHub.
- **Cloudflare Pages** rebuilds and publishes the site automatically, about a minute after each save.
- **GoDaddy** keeps the domain registration. Only its nameservers change.

---

## One-time setup (about an hour, plus waiting for DNS)

Keep Squarespace running until step 5. The site temporarily loads some images from Squarespace, and step 2 copies them over.

### 1. Put the files on GitHub
1. Create a free account at github.com.
2. Click **New repository**. Name it `emilylange-site` and make it **Public** or **Private** (either works). Click **Create**.
3. On the new repo page, click **uploading an existing file**. Drag in **everything inside** this folder, then click **Commit changes**.
   - On a Mac, press **Cmd + Shift + .** in Finder to show hidden items. The upload must include `.pages.yml` and the `.github` folder.

### 2. Copy your images off Squarespace
1. In the repo, open the **Actions** tab. If asked, click **I understand… enable them**.
2. Click **Save Squarespace images**, then **Run workflow**.
3. After about a minute it turns green, and `src/images/` now holds all 58 images. If any image fails, the log lists it, and you can upload that one in the editor later.

### 3. Publish on Cloudflare Pages
1. Create a free account at dash.cloudflare.com.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**, and choose `emilylange-site`.
3. Enter these build settings:
   - Framework preset: **None**
   - Build command: `node build.js`
   - Build output directory: `_site`
4. Click **Save and Deploy**. You'll get a preview address like `emilylange-site.pages.dev`. Check it over before moving on.

### 4. Point emilylange.com at it (domain stays at GoDaddy)
1. In Cloudflare, click **Add a domain**, enter `emilylange.com`, and pick the **Free** plan.
2. Cloudflare imports your current DNS records. **Delete** the ones that point to Squarespace: the A records for `@` and the CNAME for `www` that points to `ext-squarespace.com` or similar. Keep anything email-related.
3. Cloudflare shows two nameservers, for example `ada.ns.cloudflare.com`.
4. In GoDaddy, go to **My Products → emilylange.com → DNS → Nameservers → Change → I'll use my own nameservers**. Paste both, then save.
5. Wait for Cloudflare to email you that the domain is active. This is usually under an hour, but can take up to 24.
6. Go to **Workers & Pages → emilylange-site → Custom domains → Set up a custom domain**. Add `emilylange.com`, then do the same for `www.emilylange.com`.

### 5. Turn on the contact form
1. Go to web3forms.com and click **Create your Access Key**. Enter the email address where messages should arrive. The key is emailed to you, and no account or password is needed.
2. In the editor (step below), open **Home page & site details**, paste the key into **Contact form key**, and click **Save**.
3. Send yourself a test message from the live site. The free plan delivers up to 250 messages a month. Until the key is added, the form tells visitors to use your email address instead.

### 6. Cancel Squarespace
Once emilylange.com shows the new site and step 2 succeeded, cancel the Squarespace site plan. Old links still work: `/work-1/hera` automatically forwards to `/work/hera`.

---

## Editing the site

1. Go to **app.pagescms.org** and sign in with GitHub.
2. The first time only, click **Install** to give Pages CMS access to the `emilylange-site` repo.
3. Open the repo. You'll see two sections:
   - **Projects**: one entry per case study.
   - **Home page & site details**: the headline, intro, About text, photo, and links.
4. Edit, then click **Save**. The live site updates in about a minute.

**Add a project:** go to **Projects → Add an entry**. Fill in the name, web address (for example `new-project`), position, summary, and cover image, then write the case study. Each image you upload is saved with the site.

**Captions:** put a line of *italic text* right after an image, and it becomes that image's caption.

**Side-by-side images:** put two images on back-to-back lines, with no blank line between them, and they sit side by side.

**Reorder projects:** change **Position within its section**. 1 shows first.

**Just wrapped a project?** Turn on **Content coming soon**. The home page shows a short note and the case study stays hidden until you turn it off. Write your own wording in **Coming soon note**, or leave it empty for the default.

**Work vs. Self-launched:** choose the **Home page section** for each project.

**Projects without a cover image** show a light grey tile with the project name until you add one.

**Hide a project:** turn off **Show on site**.

**Colors and fonts:** these live at the top of `assets/styles.css`.

## For tinkering

- Preview on your computer: `node build.js`, then open `_site/index.html`, or run `npm run preview`.
- There are no packages to install or update. `build.js` turns `content/` into the pages in `_site/`.
- Content is plain JSON in `content/`. If Pages CMS ever goes away, you can still edit those files directly on GitHub.
