async function check() {
  const url='https://api.github.com/repos/typst/packages/contents/packages/preview/isc-hei-bthesis/0.6.0/src/bachelor_thesis.typ';
  const res = await fetch(url, { headers:{ 'User-Agent':'TISC-Editor-App' } });
  console.log('status',res.status);
  const data = await res.text();
  console.log(data.slice(0,400));
}
check().catch(e=>console.error(e));
