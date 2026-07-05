// www.babymama.my → babymama.my (301 redirect for SEO)
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  if (url.hostname === 'www.babymama.my') {
    return Response.redirect(
      `https://babymama.my${url.pathname}${url.search}`,
      301
    );
  }
  
  // Not www - pass through
  return context.next();
}
