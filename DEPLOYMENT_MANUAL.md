# Deployment Manual for Bebias Widget

## Vercel Deployment Steps
1. **Import the Repository**:
   - Go to Vercel and import the `bebias-widget` repository.
   - Select the main branch for deployment.

2. **Set Environment Variables**:
   - Add any required environment variables for your chat API, such as:
     - `OPENAI_API_KEY` (or any other provider key used in `app/api/chat/route.ts`).
     - Any other necessary keys.

3. **Deploy**:
   - Click on the deploy button to start the deployment process.
   - After deployment, the widget URL will be: `https://YOUR-VERCEL-DOMAIN/widget`.

## WordPress Plugin Setup
1. **Upload the Plugin**:
   - Go to your WordPress admin panel.
   - Navigate to Plugins → Add New → Upload Plugin.
   - Upload the `bebias-chatbot-plugin.zip` file.

2. **Activate the Plugin**:
   - After uploading, activate the plugin.

3. **Set Widget URL**:
   - Go to the plugin settings.
   - Set the Widget URL to your Vercel `/widget` URL.

4. **Use the Shortcode**:
   - Place the shortcode `[bebias_widget width="420" height="600"]` on any page or post where you want the chat widget to appear.

## Notes
- Ensure that the main monorepo remains untouched; `bebias-widget` is the minimal deployment source.
- If you later want the plugin files in the new repo as well, you can add a `/wordpress-plugin` folder there.
