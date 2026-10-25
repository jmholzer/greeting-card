<a name="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<div align="center">
  <a href="https://github.com/jmholzer/greeting-card">
    <img src="README_images/logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Greeting Card</h3>

  <p align="center">
    A free, customizable, and self-hostable greeting card template built using Next.js and Framer Motion. It allows multiple people to sign and contribute to a digital card that you can customise for whatever occasion.
    <br />
    <a href="https://greeting-card-demo.vercel.app/">View Demo</a>
    ·
    <a href="https://github.com/jmholzer/greeting-card/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    ·
    <a href="https://github.com/jmholzer/greeting-card/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#customising-your-card">Customising your card</a></li>
    <li><a href="#environment-variables">Environment variables</a></li>
    <li><a href="#local-development">Local development</a></li>
    <li><a href="#self-hosting-on-vercel">Self-hosting on Vercel</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

[![Product Name Screen Shot][product-screenshot]](https://greeting-card-demo.vercel.app/)

View the card at the main route (`/`).

Sign the card at `/sign` (up to 16 messages).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Next][Next.js]][Next-url]
* [![React][React.js]][React-url]
* [Prisma](https://www.prisma.io/) with PostgreSQL

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Customising your card

* The card front defaults to `public/card-front-default.jpg`. To use your own, set `NEXT_PUBLIC_CARD_FRONT_URL` (see [Environment variables](#environment-variables)). Either add your image to `public/` and set the variable to its path, for example `/front.jpg`, or set it to a full `https://` URL. Only that exact URL is allowed for remote images, and the variable is read at build time, so rebuild or redeploy after changing it. Use a landscape image with an aspect ratio of 1:1.414. [Canva](https://www.canva.com/create/greeting-cards/) is a good place to find design templates.
* The page background defaults to orange (`#e66b1e`). Set `NEXT_PUBLIC_CARD_BACKGROUND_COLOR` to change it, using a hex colour such as `#304D30`, a colour name such as `tomato`, or an `rgb()` or `hsl()` value. Invalid values are ignored. Like the card front, it is read at build time.
* Upgrading from an earlier version that expected `public/front.jpg`? Set `NEXT_PUBLIC_CARD_FRONT_URL=/front.jpg` to keep using it.
* Replace `app/favicon.ico`.
* Change the page title and description in `app/layout.tsx`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Environment variables

Copy `.env.example` to `.env` and fill it in. Use `.env` rather than `.env.local`, because the Prisma CLI only reads `.env`. It is git-ignored, so your credentials are not committed.

| Variable | Description |
| --- | --- |
| `POSTGRES_PRISMA_URL` | PostgreSQL connection string used by the app (a pooled connection on Vercel Postgres). |
| `POSTGRES_URL_NON_POOLING` | Direct PostgreSQL connection string, used by Prisma for schema changes. It can be the same as `POSTGRES_PRISMA_URL` for a local database. |
| `NEXT_PUBLIC_CARD_FRONT_URL` | Optional. Overrides the default card front with a path in `public/` (e.g. `/front.jpg`) or an `https://` URL. Read at build time. |
| `NEXT_PUBLIC_CARD_BACKGROUND_COLOR` | Optional. Page background colour: hex, colour name, or `rgb()`/`hsl()`. Defaults to `#e66b1e`. Read at build time. |
| `ADMIN_TOKEN` | Optional. A long random secret that enables the admin delete route (see [Moderation](#moderation)). Leave it unset to keep the route disabled. Generate one with `openssl rand -hex 32` and never commit it. |
| `HOST` | The base URL of the running site, with no trailing slash (e.g. `http://localhost:3000` locally, or your deployment URL). The home page uses it to fetch messages from `/api/messages`. |

On Vercel, the two `POSTGRES_*` variables are added for you when you connect a Vercel Postgres database. You only need to add `HOST` yourself.

## Moderation

To remove a message, set `ADMIN_TOKEN` and call the delete route with it. Message ids are in the `/api/messages` response.

    curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://your-site.example/api/admin/messages/<id>

Without `ADMIN_TOKEN` the route returns 404. After 10 wrong tokens from one address in 10 minutes it returns 429.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Local development

You need Node.js 20.9 or later and a PostgreSQL database. Any Postgres works; for example, with Docker:

```sh
docker run --name greeting-card-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=greeting_card -p 5432:5432 -d postgres:16
```

1. Install dependencies (this also runs `prisma generate`)

   ```sh
   npm install
   ```

2. Create your environment file and edit the values if your database differs

   ```sh
   cp .env.example .env
   ```

3. Optionally set your own card front with `NEXT_PUBLIC_CARD_FRONT_URL` (see [Customising your card](#customising-your-card))

4. Create the database tables

   ```sh
   npx prisma db push
   ```

5. Start the dev server

   ```sh
   npm run dev
   ```

6. Open <http://localhost:3000> to view the card and <http://localhost:3000/sign> to sign it.

Other useful scripts: `npm run build` (production build), `npm start` (serve the production build) and `npm run lint`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Self-hosting on Vercel

0. Clone the repo

   ```sh
   git clone https://github.com/jmholzer/greeting-card.git
   ```

1. Customise your card: optionally set `NEXT_PUBLIC_CARD_FRONT_URL`, replace `app/favicon.ico` and update `app/layout.tsx` (see [Customising your card](#customising-your-card))

2. Install NPM packages

   ```sh
   npm install
   ```

3. Install the Vercel CLI and login

   ```sh
   npm i -g vercel
   vercel login
   ```

4. Deploy a new Vercel project for your card

   ```sh
   vercel deploy
   ```

5. [Create a Postgres database on Vercel and connect it with your new project](https://vercel.com/docs/storage/vercel-postgres/quickstart#create-a-postgres-database)

6. Add the `HOST` environment variable to the Vercel project (this can be any URL that points to your deployment)

   ```sh
   HOST=https://greeting-card-demo.vercel.app
   ```

7. Pull the DB environment variables to your local `.env` file (the Prisma CLI reads `.env`, not `.env.local`)

   ```sh
   vercel env pull .env
   ```

8. Create a Prisma client

   ```sh
   npx prisma generate
   ```

9. Create the DB tables

   ```sh
   npx prisma db push
   ```

10. Redeploy your project to load the new env vars

    ```sh
    vercel --prod
    ```

11. Navigate to your project's URL and check that you can view (`/`) and sign (`/sign`) the card.

From here you can put your own domain in front of your deployment and share the link.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

See the [open issues](https://github.com/jmholzer/greeting-card/issues) for a full list of proposed features (and known issues).

Feel free to open an issue or contribute a PR:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[contributors-shield]: https://img.shields.io/github/contributors/jmholzer/greeting-card.svg?style=for-the-badge
[contributors-url]: https://github.com/jmholzer/greeting-card/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/jmholzer/greeting-card.svg?style=for-the-badge
[forks-url]: https://github.com/jmholzer/greeting-card/network/members
[stars-shield]: https://img.shields.io/github/stars/jmholzer/greeting-card.svg?style=for-the-badge
[stars-url]: https://github.com/jmholzer/greeting-card/stargazers
[issues-shield]: https://img.shields.io/github/issues/jmholzer/greeting-card.svg?style=for-the-badge
[issues-url]: https://github.com/jmholzer/greeting-card/issues
[license-shield]: https://img.shields.io/github/license/jmholzer/greeting-card.svg?style=for-the-badge
[license-url]: https://github.com/jmholzer/greeting-card/blob/main/LICENSE
[product-screenshot]: README_images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
