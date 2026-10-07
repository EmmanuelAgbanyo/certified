import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignOutButton, SignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Pencil,
  Trash2,
  Users,
  Save,
  Eye,
  FileImage,
  FileText,
  GraduationCap,
  Landmark,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetAdminOverviewQueryKey,
  getGetCertificateNameStyleQueryKey,
  getListBatchRecipientsQueryKey,
  getListBatchesQueryKey,
  getListInstitutionsQueryKey,
  useAddBatchRecipients,
  useCreateBatch,
  useCreateInstitution,
  useDeleteBatchRecipient,
  useDeleteCertificateBatch,
  useDeleteInstitution,
  useDownloadCertificate,
  useGetAdminOverview,
  useGetCertificateNameStyle,
  useListBatchRecipients,
  useListBatches,
  useListInstitutions,
  useRequestUploadUrl,
  useSearchCertificates,
  useVerifyCertificate,
  useUpdateBatchRecipient,
  useUpdateCertificateBatch,
  useUpdateCertificateNameStyle,
  useUpdateInstitution,
} from '@workspace/api-client-react';
import { Route, Switch, Link, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.DEV
  ? import.meta.env.VITE_CLERK_PROXY_URL || undefined
  : import.meta.env.VITE_CLERK_PROXY_URL ||
    `${window.location.origin}${basePath}/api/__clerk`;
const stripBase = (path: string) =>
  basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
const normalizeInstitutionInput = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#214c40',
    colorForeground: '#203c35',
    colorMutedForeground: '#687970',
    colorDanger: '#b74438',
    colorBackground: '#fffdf7',
    colorInput: '#fffdf7',
    colorInputForeground: '#203c35',
    colorNeutral: '#ddd6c8',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-[#203c35]',
    headerSubtitle: 'text-[#687970]',
    formFieldLabel: 'text-[#203c35]',
    footerActionLink: 'text-[#214c40]',
    formButtonPrimary: 'bg-[#214c40] hover:bg-[#17392f]',
    formFieldInput: 'border-[#ddd6c8] rounded-lg',
  },
};

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-mark ${inverse ? 'brand-mark-inverse' : ''}`} aria-hidden="true">
      <span className="brand-mark-inner"><GraduationCap size={20} strokeWidth={1.8} /></span>
    </span>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-width flex h-[78px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-home-logo">
          <BrandMark />
          <span className="leading-tight">
            <span className="block font-semibold tracking-[-.03em] text-[#203c35]">Merit<span className="text-[#b28a37]">Mark</span></span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.23em] text-[#7c877e]">Ghana certificate portal</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how-it-works" className="hidden text-[#67766e] transition hover:text-[#214c40] sm:block" data-testid="link-how-it-works">How it works</a>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-[#d9d3c5] px-4 py-2.5 font-semibold text-[#214c40] transition hover:border-[#214c40] hover:bg-[#f2eee3]" data-testid="link-administrator">
            <LockKeyhole size={14} /> Administrator
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HomePage() {
  const institutionsQuery = useListInstitutions();
  const search = useSearchCertificates();
  const verify = useVerifyCertificate();
  const download = useDownloadCertificate();
  const [institutionId, setInstitutionId] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationInstitution, setVerificationInstitution] = useState('');
  const [verificationFullName, setVerificationFullName] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [previewPendingId, setPreviewPendingId] = useState<string | null>(null);
  const institutions = institutionsQuery.data ?? [];
  const matches = search.data ?? [];
  const verificationMatches = verify.data ?? [];
  const matchedVerificationInstitution = institutions.find(
    (institution) =>
      normalizeInstitutionInput(institution.name) ===
      normalizeInstitutionInput(verificationInstitution),
  );

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institutionId || nameQuery.trim().length < 2) return;
    setDownloadError('');
    setPreview(null);
    search.mutate({ data: { institutionId, name: nameQuery.trim() } });
  }

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matchedVerificationInstitution || verificationFullName.trim().length < 2) return;
    setDownloadError('');
    setPreview(null);
    verify.mutate({
      data: {
        institutionId: matchedVerificationInstitution.id,
        fullName: verificationFullName.trim(),
      },
    });
  }

  async function viewCertificate(id: string, name: string) {
    setDownloadError('');
    setPreviewPendingId(id);
    try {
      const blob = await download.mutateAsync({ recipientId: id, data: { fullName: name } });
      setPreview({ url: URL.createObjectURL(blob), name });
    } catch {
      setDownloadError('We could not prepare this certificate just now. Please try again.');
    } finally {
      setPreviewPendingId(null);
    }
  }

  async function downloadCertificate(id: string, name: string) {
    setDownloadError('');
    try {
      const blob = await download.mutateAsync({ recipientId: id, data: { fullName: name } });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${name.trim().replace(/\s+/g, '-')}-certificate.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setDownloadError('We could not prepare this certificate just now. Please try again.');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#f6f3eb] text-[#203c35]">
      <SiteHeader />
      <main>
        <section className="hero-panel grain relative overflow-hidden">
          <div className="page-width relative z-[1] grid min-h-[526px] items-center gap-10 py-16 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
            <div className="rise-in max-w-[640px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[.08] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[.17em] text-[#e4d7ad]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#cfad5f]" /> Ghana · verified achievements
              </div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-[#c7b57e]">A milestone worth keeping</p>
              <h1 className="serif max-w-[590px] text-[clamp(2.7rem,6vw,5.25rem)] leading-[1.07] tracking-[-.055em] text-[#fbf8ef]">
                Your hard work.<br /><em className="font-normal text-[#d8c78f]">Made official.</em>
              </h1>
              <p className="mt-6 max-w-[440px] text-base leading-7 text-[#d1ddd4]">
                Find and download your certificate from your institution. A simple, secure way to keep your achievement close.
              </p>
              <div className="mt-9 flex items-center gap-3 text-xs text-[#cfdbd3]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20"><ShieldCheck size={15} /></span>
                Search by name within your institution
              </div>
            </div>
            <div className="relative hidden min-h-[360px] items-center justify-center lg:flex">
              <div className="absolute h-[310px] w-[310px] rounded-full border border-[#d9c786]/20" />
              <div className="absolute h-[260px] w-[260px] rounded-full border border-[#d9c786]/15" />
              <div className="certificate-illustration relative flex h-[270px] w-[390px] -rotate-[4deg] flex-col justify-between p-7">
                <div className="flex items-start justify-between">
                  <BrandMark inverse />
                  <span className="rounded-full border border-[#a68c46]/40 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.18em] text-[#837039]">Verified</span>
                </div>
                <div className="text-center">
                  <div className="mb-3 text-[8px] font-semibold uppercase tracking-[.28em] text-[#787b65]">Certificate of achievement</div>
                  <div className="serif text-[20px] text-[#26493e]">A future well earned</div>
                  <div className="mx-auto mt-3 h-px w-16 bg-[#b69c58]" />
                  <div className="mt-3 text-[8px] tracking-[.18em] text-[#74776a]">GHANA · EDUCATION & TRAINING</div>
                </div>
                <div className="flex items-end justify-between text-[8px] text-[#77796d]">
                  <span>OFFICIAL RECORD</span>
                  <span className="serif text-[21px] text-[#aa8c3e]">MM</span>
                  <span>MERITMARK</span>
                </div>
              </div>
              <div className="absolute bottom-[8%] right-[4%] flex items-center gap-3 rounded-xl border border-white/10 bg-[#244b3f] px-4 py-3 shadow-xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbc77e] text-[#214c40]"><BadgeCheck size={17} /></span>
                <span><span className="block text-[11px] font-semibold text-[#f8f3e4]">Your achievement, protected</span><span className="mt-1 block text-[9px] text-[#b9cbc0]">No public recipient directory</span></span>
              </div>
            </div>
          </div>
          <div className="hero-bottom-rule" />
        </section>

        <section className="relative z-10 -mt-9 px-5 sm:px-8" aria-labelledby="lookup-heading">
          <div className="mx-auto max-w-[940px] rounded-[18px] border border-[#e2dccf] bg-[#fffdf8] p-5 shadow-[0_24px_70px_-38px_rgba(26,58,46,.28)] sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#a47d31]">Certificate lookup</p>
                <h2 id="lookup-heading" className="serif text-[25px] tracking-[-.04em] text-[#203c35]">Find your certificate</h2>
                <p className="mt-2 text-sm text-[#728078]">Search by your first name, last name, or any part of your name.</p>
              </div>
              <span className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#f3efe2] text-[#426e5b] sm:flex"><Search size={18} /></span>
            </div>
            <form onSubmit={submitSearch} className="grid gap-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#334d43]">Institution</span>
                <span className="relative block">
                  <select
                    value={institutionId}
                    onChange={(event) => setInstitutionId(event.target.value)}
                    className="form-control appearance-none pr-10"
                    data-testid="select-institution"
                    required
                    disabled={institutionsQuery.isLoading || institutions.length === 0}
                  >
                    <option value="">{institutionsQuery.isLoading ? 'Loading institutions…' : institutions.length ? 'Select your institution' : 'No institutions available'}</option>
                    {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#77847d]" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#334d43]">Name</span>
                <input
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  className="form-control"
                  placeholder="Enter at least 2 letters"
                  minLength={2}
                  maxLength={180}
                  autoComplete="off"
                  data-testid="input-name-search"
                  required
                />
              </label>
              <button className="primary-button min-h-[46px] justify-center md:min-w-[144px]" type="submit" disabled={search.isPending || !institutions.length} data-testid="button-search-certificate">
                {search.isPending ? <span className="button-shimmer">Searching…</span> : <>Search certificates <ArrowRight size={15} /></>}
              </button>
            </form>
            {institutionsQuery.isError && <QueryNotice text="Institutions could not be loaded." onRetry={() => institutionsQuery.refetch()} testId="status-institutions-error" />}
            {institutionsQuery.isLoading && <div className="mt-5 h-12 animate-pulse rounded-lg bg-[#f0ede5]" />}
            {institutions.length === 0 && !institutionsQuery.isLoading && !institutionsQuery.isError && (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f5f2e9] p-4 text-sm text-[#687970]" data-testid="status-no-institutions">
                <Landmark size={18} className="shrink-0 text-[#9e8040]" /> Certificates from participating institutions will appear here.
              </div>
            )}
            {search.isError && <p className="mt-5 flex items-center gap-2 text-sm text-[#a54237]" role="alert" data-testid="status-search-error"><CircleAlert size={16} /> We couldn’t complete your search. Check your connection and try again.</p>}
            {search.isSuccess && (
              <div className="mt-7 border-t border-[#e9e3d7] pt-6" data-testid="region-search-results">
                {matches.length ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div><div className="flex items-center gap-2 text-sm font-semibold text-[#244a3e]"><Check size={16} /> Matching certificates</div><p className="mt-1 text-xs text-[#77837b]">Matches for “{nameQuery.trim()}” in this institution.</p></div>
                      <span className="text-[11px] font-medium text-[#77837b]">{matches.length === 20 ? 'Showing up to 20 — add more letters to narrow results' : `${matches.length} ${matches.length === 1 ? 'certificate' : 'certificates'}`}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {matches.map((match) => (
                        <article className="match-card" key={match.id} data-testid={`card-certificate-${match.id}`}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf1e7] text-[#416951]"><FileText size={19} /></span>
                            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#233f36]" data-testid={`text-certificate-name-${match.id}`}>{match.fullName}</span><span className="mt-1 block truncate text-xs text-[#748078]">{match.institutionName} · {match.batchTitle}</span></span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button className="secondary-button justify-center" onClick={() => viewCertificate(match.id, match.fullName)} disabled={download.isPending} data-testid={`button-view-${match.id}`}>
                              <Eye size={15} /> {previewPendingId === match.id ? 'Opening…' : 'View'}
                            </button>
                            <button className="download-button justify-center" onClick={() => downloadCertificate(match.id, match.fullName)} disabled={download.isPending} data-testid={`button-download-${match.id}`}>
                              <ArrowDownToLine size={15} /> {download.isPending && previewPendingId !== match.id ? 'Preparing…' : 'Download PDF'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {downloadError && <p className="mt-3 text-sm text-[#a54237]" role="alert" data-testid="status-download-error">{downloadError}</p>}
                  </>
                ) : (
                  <div className="flex gap-4 rounded-xl bg-[#f5f2e9] p-5" data-testid="status-no-match">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ece6d5] text-[#947a3e]"><Search size={18} /></span>
                    <div><h3 className="text-sm font-semibold text-[#304a3f]">No certificate found for that name</h3><p className="mt-1 max-w-[620px] text-sm leading-6 text-[#718078]">Try a shorter part of your name, check the spelling, or choose another institution. Results are limited to the institution you selected.</p></div>
                  </div>
                )}
              </div>
            )}

            <section className="mt-7 border-t border-[#e9e3d7] pt-6" aria-labelledby="verification-heading">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 id="verification-heading" className="text-sm font-semibold text-[#304a3f]">Can’t find your certificate?</h3>
                  <p className="mt-1 max-w-[620px] text-sm leading-6 text-[#718078]">
                    Check your full name against the recipient list uploaded by your institution.
                  </p>
                </div>
                <button
                  className="secondary-button justify-center"
                  type="button"
                  onClick={() => setVerificationOpen((open) => !open)}
                  aria-expanded={verificationOpen}
                  aria-controls="certificate-verification-form"
                  data-testid="button-toggle-certificate-verification"
                >
                  {verificationOpen ? 'Close form' : 'Verify full name'}
                </button>
              </div>

              {verificationOpen && (
                <div id="certificate-verification-form" className="mt-5">
                  <form onSubmit={submitVerification} className="grid gap-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-[#334d43]">Institution</span>
                      <input
                        type="text"
                        list="verification-institution-options"
                        value={verificationInstitution}
                        onChange={(event) => {
                          setVerificationInstitution(event.target.value);
                          verify.reset();
                        }}
                        className="form-control"
                        placeholder="Start typing your institution"
                        autoComplete="organization"
                        aria-describedby="verification-institution-help"
                        data-testid="input-verification-institution"
                        required
                        disabled={institutionsQuery.isLoading || institutions.length === 0}
                      />
                      <datalist id="verification-institution-options">
                        {institutions.map((institution) => (
                          <option key={institution.id} value={institution.name} />
                        ))}
                      </datalist>
                      <span id="verification-institution-help" className="mt-2 block text-xs text-[#77837b]">
                        {verificationInstitution.trim() && !matchedVerificationInstitution
                          ? 'Choose an institution from the suggestions.'
                          : 'Choose a name from the suggestions so it matches the institution records.'}
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-[#334d43]">Full name</span>
                      <input
                        value={verificationFullName}
                        onChange={(event) => {
                          setVerificationFullName(event.target.value);
                          verify.reset();
                        }}
                        className="form-control"
                        placeholder="Enter your name as it appears on the certificate"
                        autoComplete="name"
                        minLength={2}
                        maxLength={180}
                        required
                        data-testid="input-verification-full-name"
                      />
                    </label>
                    <button
                      className="primary-button min-h-[46px] justify-center md:min-w-[144px]"
                      type="submit"
                      disabled={
                        verify.isPending ||
                        !matchedVerificationInstitution ||
                        verificationFullName.trim().length < 2
                      }
                      data-testid="button-verify-certificate"
                    >
                      {verify.isPending ? 'Checking…' : <>Check records <ArrowRight size={15} /></>}
                    </button>
                  </form>

                  {verify.isError && (
                    <p className="mt-4 flex items-center gap-2 text-sm text-[#a54237]" role="alert" data-testid="status-verification-error">
                      <CircleAlert size={16} /> We couldn’t check the uploaded records just now. Please wait a moment and try again.
                    </p>
                  )}

                  {verify.isSuccess && (
                    <div className="mt-5 border-t border-[#e9e3d7] pt-5" data-testid="region-exact-verification">
                      {verificationMatches.length ? (
                        <>
                          <div className="mb-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[#244a3e]">
                              <Check size={16} /> Certificate record verified
                            </div>
                            <p className="mt-1 text-xs text-[#77837b]">
                              Select the certificate you want from {matchedVerificationInstitution?.name}.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {verificationMatches.map((match) => (
                              <article className="match-card" key={match.id} data-testid={`card-verified-certificate-${match.id}`}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf1e7] text-[#416951]"><FileText size={19} /></span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-[#233f36]">{match.fullName}</span>
                                    <span className="mt-1 block truncate text-xs text-[#748078]">{match.institutionName} · {match.batchTitle}</span>
                                  </span>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                  <button
                                    className="secondary-button justify-center"
                                    type="button"
                                    onClick={() => viewCertificate(match.id, match.fullName)}
                                    disabled={download.isPending}
                                    data-testid={`button-verify-view-${match.id}`}
                                  >
                                    <Eye size={15} /> {previewPendingId === match.id ? 'Opening…' : 'View'}
                                  </button>
                                  <button
                                    className="download-button justify-center"
                                    type="button"
                                    onClick={() => downloadCertificate(match.id, match.fullName)}
                                    disabled={download.isPending}
                                    data-testid={`button-verify-download-${match.id}`}
                                  >
                                    <ArrowDownToLine size={15} /> {download.isPending && previewPendingId !== match.id ? 'Preparing…' : 'Download PDF'}
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                          {downloadError && <p className="mt-3 text-sm text-[#a54237]" role="alert" data-testid="status-download-error">{downloadError}</p>}
                        </>
                      ) : (
                        <div className="flex gap-4 rounded-xl bg-[#f5f2e9] p-5" role="status" data-testid="status-verified-no-match">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ece6d5] text-[#947a3e]"><Search size={18} /></span>
                          <div>
                            <h4 className="text-sm font-semibold text-[#304a3f]">No exact record found</h4>
                            <p className="mt-1 max-w-[620px] text-sm leading-6 text-[#718078]">
                              Check the spelling and institution. If your name is still missing, contact the institution so its administrator can add your recipient record.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </section>

        <section id="how-it-works" className="page-width py-[88px]">
          <div className="grid gap-10 md:grid-cols-[.8fr_1.2fr] md:items-start">
            <div className="max-w-[340px]">
              <p className="eyebrow"><span className="eyebrow-mark" /> Simple by design</p>
              <h2 className="serif mt-4 text-3xl leading-tight tracking-[-.04em] text-[#203c35]">A few details.<br />A lasting record.</h2>
              <p className="mt-4 text-sm leading-6 text-[#6f7e75]">Your certificate belongs to you. Our lookup keeps the process focused, private and clear.</p>
            </div>
            <div className="divide-y divide-[#e2dccf] border-y border-[#e2dccf]">
              <Step number="01" title="Choose your institution" detail="Select the school or organisation that issued your certificate." icon={<Building2 size={18} />} />
              <Step number="02" title="Search by name" detail="Use your first name, last name, or another part of your name." icon={<UsersRound size={18} />} />
              <Step number="03" title="View and download your certificate" detail="Preview your certificate in the portal, then save a PDF copy." icon={<ArrowDownToLine size={18} />} />
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#ded8ca] bg-[#f0ede4]">
        <div className="page-width flex flex-col gap-4 py-7 text-xs text-[#778078] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><BrandMark /><span className="font-semibold text-[#314b40]">MeritMark</span><span className="mx-1 text-[#bbb4a5]">/</span><span>Ghana certificate portal</span></div>
          <span>Private by design. Built for your next step.</span>
        </div>
      </footer>
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#10251d]/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <section
            className="flex h-[94dvh] w-full max-w-[1000px] flex-col overflow-hidden rounded-t-2xl border border-[#ded8ca] bg-[#fffdf8] shadow-2xl sm:h-[min(90dvh,900px)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Certificate preview for ${preview.name}`}
          >
            <header className="flex min-h-[62px] items-center justify-between gap-4 border-b border-[#e7e1d6] px-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[#29463b]">Certificate preview</h2>
                <p className="truncate text-xs text-[#758078]">{preview.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={preview.url}
                  download={`${preview.name.trim().replace(/\s+/g, '-')}-certificate.pdf`}
                  className="download-button min-h-9"
                  data-testid="button-preview-download"
                >
                  <ArrowDownToLine size={14} /> Download PDF
                </a>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e1dbce] text-[#54695c] hover:bg-[#f2efe7]"
                  onClick={() => setPreview(null)}
                  aria-label="Close certificate preview"
                  data-testid="button-close-preview"
                >
                  <X size={17} />
                </button>
              </div>
            </header>
            <iframe className="min-h-0 flex-1 bg-[#e8e5dc]" src={preview.url} title={`Certificate for ${preview.name}`} />
          </section>
        </div>
      )}
    </div>
  );
}

function Step({ number, title, detail, icon }: { number: string; title: string; detail: string; icon: ReactNode }) {
  return (
    <article className="flex items-start gap-4 py-5 sm:gap-6">
      <span className="pt-1 font-mono text-[11px] text-[#a88a43]">{number}</span>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ddd7c9] text-[#54715f]">{icon}</span>
      <div className="flex-1"><h3 className="text-sm font-semibold text-[#29483d]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#758078]">{detail}</p></div>
    </article>
  );
}

function QueryNotice({ text, onRetry, testId }: { text: string; onRetry: () => void; testId: string }) {
  return <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#ecd2cc] bg-[#fbf0ed] p-3 text-sm text-[#9a473a]" data-testid={testId}><span className="flex items-center gap-2"><CircleAlert size={16} /> {text}</span><button className="text-xs font-bold underline underline-offset-2" onClick={onRetry} data-testid={`${testId}-retry`}>Try again</button></div>;
}

function AdminPage() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const overviewQuery = useGetAdminOverview({ query: { enabled: isSignedIn === true, queryKey: getGetAdminOverviewQueryKey() } });
  const institutionsQuery = useListInstitutions({ query: { enabled: isSignedIn === true, queryKey: getListInstitutionsQueryKey() } });
  const batchesQuery = useListBatches({ query: { enabled: isSignedIn === true, queryKey: getListBatchesQueryKey() } });
  const styleQuery = useGetCertificateNameStyle({ query: { enabled: isSignedIn === true, queryKey: getGetCertificateNameStyleQueryKey() } });
  const createInstitution = useCreateInstitution();
  const createBatch = useCreateBatch();
  const requestUpload = useRequestUploadUrl();
  const updateInstitution = useUpdateInstitution();
  const deleteInstitution = useDeleteInstitution();
  const updateBatch = useUpdateCertificateBatch();
  const deleteBatch = useDeleteCertificateBatch();
  const addRecipients = useAddBatchRecipients();
  const updateRecipient = useUpdateBatchRecipient();
  const deleteRecipient = useDeleteBatchRecipient();
  const updateNameStyle = useUpdateCertificateNameStyle();
  const [institutionName, setInstitutionName] = useState('');
  const [batchTitle, setBatchTitle] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [recipientText, setRecipientText] = useState('');
  const [recipientFileName, setRecipientFileName] = useState('');
  const [template, setTemplate] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [editingInstitution, setEditingInstitution] = useState<string | null>(null);
  const [institutionDraft, setInstitutionDraft] = useState('');
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [batchDraft, setBatchDraft] = useState({ title: '', institutionId: '' });
  const [selectedBatchForRecipients, setSelectedBatchForRecipients] = useState('');
  const [newRecipientNames, setNewRecipientNames] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [nameStyleDraft, setNameStyleDraft] = useState({ fontFamily: 'helvetica', textColor: '#203c35', fontSize: 28 });
  const [styleInitialized, setStyleInitialized] = useState(false);
  const [managementError, setManagementError] = useState('');
  const [managementSuccess, setManagementSuccess] = useState('');
  const recipientsQuery = useListBatchRecipients(selectedBatchForRecipients, { query: { enabled: !!selectedBatchForRecipients && isSignedIn === true, queryKey: getListBatchRecipientsQueryKey(selectedBatchForRecipients) } });
  const institutions = institutionsQuery.data ?? [];
  const overview = overviewQuery.data;

  useEffect(() => {
    if (styleQuery.data && !styleInitialized) {
      setNameStyleDraft({ fontFamily: styleQuery.data.fontFamily, textColor: styleQuery.data.textColor, fontSize: styleQuery.data.fontSize });
      setStyleInitialized(true);
    }
  }, [styleQuery.data, styleInitialized]);

  async function refreshManagement() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListInstitutionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCertificateNameStyleQueryKey() }),
    ]);
  }

  async function renameInstitution(id: string) {
    const name = institutionDraft.trim();
    if (name.length < 2) return setManagementError('Institution names must be at least 2 characters.');
    setManagementError(''); setManagementSuccess('');
    try {
      await updateInstitution.mutateAsync({ institutionId: id, data: { name } });
      setEditingInstitution(null); await refreshManagement(); setManagementSuccess('Institution renamed.');
    } catch { setManagementError('Could not rename this institution. Please try again.'); }
  }

  async function removeInstitution(id: string, name: string) {
    if (!window.confirm(`Delete “${name}” and all of its records? This removes its batches, recipients, download history and template files. This cannot be undone.`)) return;
    setManagementError(''); setManagementSuccess('');
    try {
      const result = await deleteInstitution.mutateAsync({ institutionId: id });
      if (selectedBatchForRecipients) {
        setSelectedBatchForRecipients('');
        setNewRecipientNames('');
        setRecipientSearch('');
      }
      if (selectedInstitution === id) setSelectedInstitution('');
      await refreshManagement();
      setManagementSuccess(result.storageCleanupPending
        ? 'Institution records were deleted, but one or more private template files could not be removed from storage.'
        : 'Institution and related records deleted.');
    } catch { setManagementError('Could not delete this institution. Please try again.'); }
  }

  async function saveBatch(batchId: string) {
    if (batchDraft.title.trim().length < 2 || !batchDraft.institutionId) return setManagementError('Choose an institution and enter a batch title of at least 2 characters.');
    setManagementError(''); setManagementSuccess('');
    try {
      await updateBatch.mutateAsync({ batchId, data: { institutionId: batchDraft.institutionId, title: batchDraft.title.trim() } });
      setEditingBatch(null); await refreshManagement(); setManagementSuccess('Batch details updated.');
    } catch { setManagementError('Could not update this batch. Please try again.'); }
  }

  async function removeBatch(batchId: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This removes its recipients, download history and template file. This cannot be undone.`)) return;
    setManagementError(''); setManagementSuccess('');
    try {
      const result = await deleteBatch.mutateAsync({ batchId });
      if (selectedBatchForRecipients === batchId) {
        setSelectedBatchForRecipients('');
        setNewRecipientNames('');
        setRecipientSearch('');
      }
      await refreshManagement();
      setManagementSuccess(result.storageCleanupPending
        ? 'Batch records were deleted, but its private template file could not be removed from storage.'
        : 'Batch and related records deleted.');
    } catch { setManagementError('Could not delete this batch. Please try again.'); }
  }

  async function submitAdditionalRecipients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipients = newRecipientNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (!selectedBatchForRecipients || !recipients.length || recipients.some((name) => name.length < 2 || name.length > 180)) {
      setManagementError('Enter one or more full names, each between 2 and 180 characters.');
      return;
    }
    if (recipients.length > 5000) {
      setManagementError('Add no more than 5,000 names at a time.');
      return;
    }
    setManagementError(''); setManagementSuccess('');
    try {
      const result = await addRecipients.mutateAsync({ batchId: selectedBatchForRecipients, data: { recipients } });
      setNewRecipientNames('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBatchRecipientsQueryKey(selectedBatchForRecipients) }),
        queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListInstitutionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
      ]);
      setManagementSuccess(`${result.added} recipient${result.added === 1 ? '' : 's'} added${result.skipped ? `; ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}.`);
    } catch { setManagementError('Could not add these recipients. Please try again.'); }
  }

  async function saveRecipient(recipientId: string) {
    const fullName = recipientDraft.trim();
    if (fullName.length < 2 || fullName.length > 180) return setManagementError('Full name must be between 2 and 180 characters.');
    setManagementError(''); setManagementSuccess('');
    try {
      await updateRecipient.mutateAsync({ batchId: selectedBatchForRecipients, recipientId, data: { fullName } });
      setEditingRecipient(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBatchRecipientsQueryKey(selectedBatchForRecipients) }),
        queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() }),
      ]);
      setManagementSuccess('Recipient name updated.');
    } catch { setManagementError('Could not update this recipient. Please try again.'); }
  }

  async function removeRecipient(recipientId: string, fullName: string) {
    if (!window.confirm(`Delete “${fullName}”? This removes the recipient and their download history. This cannot be undone.`)) return;
    setManagementError(''); setManagementSuccess('');
    try {
      await deleteRecipient.mutateAsync({ batchId: selectedBatchForRecipients, recipientId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBatchRecipientsQueryKey(selectedBatchForRecipients) }),
        queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
      ]);
      setManagementSuccess('Recipient and download history deleted.');
    } catch { setManagementError('Could not delete this recipient. Please try again.'); }
  }

  async function saveNameStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setManagementError(''); setManagementSuccess('');
    if (!/^#[0-9a-fA-F]{6}$/.test(nameStyleDraft.textColor)) return setManagementError('Use a six-digit hex color, such as #203c35.');
    try {
      await updateNameStyle.mutateAsync({ data: { fontFamily: nameStyleDraft.fontFamily as 'helvetica' | 'helveticaBold' | 'timesRoman' | 'timesRomanBold' | 'courier' | 'courierBold', textColor: nameStyleDraft.textColor, fontSize: Number(nameStyleDraft.fontSize) } });
      await queryClient.invalidateQueries({ queryKey: getGetCertificateNameStyleQueryKey() });
      setManagementSuccess('Global certificate name style saved.');
    } catch { setManagementError('Could not save the certificate name style. Please try again.'); }
  }

  async function importNamesFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError('');
    try {
      const content = (await file.text()).replace(/^\uFEFF/, '');
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      const rows = lines.map((line) =>
        line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((cell) => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')),
      );
      const header = rows[0]?.map((cell) => cell.toLowerCase().replace(/[\s_-]+/g, ''));
      const nameColumn = header?.findIndex((cell) => cell === 'name' || cell === 'fullname');
      let names: string[];
      if (nameColumn !== undefined && nameColumn >= 0) {
        names = rows.slice(1).map((row) => row[nameColumn] ?? '');
      } else if (rows.every((row) => row.length === 1)) {
        names = rows.map((row) => row[0] ?? '');
      } else {
        throw new Error('CSV needs a fullName column or one full name per row.');
      }
      setRecipientText(names.filter(Boolean).join('\n'));
      setRecipientFileName(file.name);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not read that names file.');
      setRecipientFileName('');
    }
  }

  if (!isLoaded) return <AdminLoading />;
  if (!isSignedIn) {
    return (
      <div className="admin-auth">
        <SiteHeader />
        <div className="mx-auto flex min-h-[calc(100dvh-78px)] max-w-lg items-center px-5 py-16">
          <div className="w-full rounded-2xl border border-[#e0dacd] bg-[#fffdf8] p-8 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9efe9] text-[#2c614d]"><LockKeyhole size={23} /></span>
            <p className="eyebrow mt-6 justify-center"><span className="eyebrow-mark" /> Administrator access</p>
            <h1 className="serif mt-3 text-3xl tracking-[-.04em]">Sign in to continue</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#758078]">The portal console is reserved for the authorised administrator. Recipient certificate lookup remains open to everyone.</p>
            <Link href="/sign-in" className="primary-button mx-auto mt-7 inline-flex" data-testid="link-admin-sign-in">Sign in securely <ArrowRight size={15} /></Link>
            <Link href="/" className="mt-5 block text-xs font-semibold text-[#557162] hover:underline" data-testid="link-return-home">Return to certificate search</Link>
          </div>
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    const status =
      typeof overviewQuery.error === 'object' &&
      overviewQuery.error !== null &&
      'status' in overviewQuery.error
        ? overviewQuery.error.status
        : undefined;
    const forbidden = status === 403;
    return (
      <div className="admin-frame min-h-[100dvh]">
        <SiteHeader />
        <main className="page-width flex min-h-[calc(100dvh-78px)] items-center justify-center py-12">
          <section className="w-full max-w-lg rounded-2xl border border-[#e0dacd] bg-[#fffdf8] p-8 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f6eeea] text-[#9a473a]"><LockKeyhole size={23} /></span>
            <h1 className="serif mt-5 text-2xl tracking-[-.04em] text-[#203c35]">{forbidden ? 'Administrator access required' : 'Admin access could not be verified'}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#758078]">
              {forbidden
                ? 'This account is not authorised to manage certificate records. Sign out and use the authorised administrator account.'
                : 'The portal could not confirm administrator access. Please retry before continuing.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {forbidden ? (
                <SignOutButton>
                  <button className="primary-button justify-center" data-testid="button-sign-out">Sign out</button>
                </SignOutButton>
              ) : (
                <button className="primary-button justify-center" onClick={() => overviewQuery.refetch()} data-testid="button-retry-admin-access">Try again</button>
              )}
              <Link href="/" className="secondary-button justify-center" data-testid="link-return-to-public-search">Public search</Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  async function submitInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(''); setSuccessMessage('');
    try {
      await createInstitution.mutateAsync({ data: { name: institutionName.trim() } });
      setInstitutionName('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListInstitutionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
      ]);
      setSuccessMessage('Institution added.');
    } catch {
      setFormError('Could not add that institution. Check the name and try again.');
    }
  }

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(''); setSuccessMessage('');
    if (!selectedInstitution || !template) {
      setFormError('Choose an institution and attach a certificate template.');
      return;
    }
    if (template.size < 1 || template.size > 20_000_000) {
      setFormError('Choose a template file smaller than 20 MB.');
      return;
    }
    const extension = template.name.toLowerCase().split('.').pop();
    const mimeByExtension: Record<string, 'application/pdf' | 'image/png' | 'image/jpeg'> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    const contentType = ['application/pdf', 'image/png', 'image/jpeg'].includes(template.type)
      ? template.type as 'application/pdf' | 'image/png' | 'image/jpeg'
      : extension ? mimeByExtension[extension] : undefined;
    if (!contentType) {
      setFormError('Template must be a PDF, PNG or JPEG file.');
      return;
    }
    const recipients = recipientText
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^["']|["']$/g, '').trim())
      .filter((line) => line && !/^(full[\s_-]*name|name)$/i.test(line));
    if (!recipients.length || recipients.some((name) => name.length < 2 || name.length > 180)) {
      setFormError('Add at least one full name. Each name should be between 2 and 180 characters, one per line.');
      return;
    }
    if (recipients.length > 5000) {
      setFormError('A batch can contain no more than 5,000 names.');
      return;
    }
    try {
      const upload = await requestUpload.mutateAsync({
        data: { name: template.name, size: template.size, contentType },
      });
      const putResponse = await fetch(upload.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: template,
      });
      if (!putResponse.ok) throw new Error('Template upload failed');
      await createBatch.mutateAsync({
        data: {
          institutionId: selectedInstitution,
          title: batchTitle.trim(),
          templatePath: upload.objectPath,
          templateFilename: template.name,
          templateContentType: contentType,
          recipients,
        },
      });
      setBatchTitle(''); setRecipientText(''); setTemplate(null); setRecipientFileName('');
      const input = document.getElementById('template-file') as HTMLInputElement | null;
      if (input) input.value = '';
      const namesInput = document.getElementById('recipient-file') as HTMLInputElement | null;
      if (namesInput) namesInput.value = '';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListInstitutionsQueryKey() }),
      ]);
      setSuccessMessage('Batch created and recipients imported.');
    } catch {
      setFormError('The batch could not be created. Check your file, names and connection, then try again.');
    }
  }

  const busy = createBatch.isPending || requestUpload.isPending;
  const filteredInstitutions = institutions.filter((institution) => institution.name.toLowerCase().includes(institutionSearch.trim().toLowerCase()));
  const filteredRecipients = (recipientsQuery.data ?? []).filter((recipient) => recipient.fullName.toLowerCase().includes(recipientSearch.trim().toLowerCase()));
  const selectedBatch = batchesQuery.data?.find((batch) => batch.id === selectedBatchForRecipients);
  return (
    <div className="admin-frame min-h-[100dvh]">
      <header className="admin-topbar">
        <div className="page-width flex h-[74px] items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark /><div><div className="font-semibold tracking-[-.03em] text-[#203c35]">MeritMark <span className="ml-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8b958d]">Console</span></div><div className="mt-0.5 text-[10px] text-[#879189]">Certificate portal administration</div></div></div>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#d9d3c5] px-4 py-2 text-xs font-semibold text-[#315244] transition hover:bg-[#f0ede4]" data-testid="link-public-portal"><Search size={14} /> Public portal</Link>
        </div>
      </header>
      <main className="page-width pb-16 pt-9 sm:pt-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="rise-in"><p className="eyebrow"><span className="eyebrow-mark" /> Portal overview</p><h1 className="serif mt-3 text-[34px] tracking-[-.05em] text-[#203c35]">Good day, administrator.</h1><p className="mt-2 text-sm text-[#758078]">Manage institutions, certificate batches, recipients and certificate name styling.</p></div>
          <div className="rounded-lg border border-[#e1dbce] bg-[#fffdf8] px-4 py-3 text-xs text-[#718078]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#5e9872]" /> Signed in · admin access is enforced by the portal</div>
        </div>

        {overviewQuery.isLoading ? <AdminStatsSkeleton /> : (
          <section className="stats-grid" aria-label="Portal totals">
            <StatCard title="Institutions" value={overview?.institutionCount ?? institutions.length} icon={<Landmark size={17} />} testId="stat-institutions" />
            <StatCard title="Certificate batches" value={overview?.batchCount ?? 0} icon={<FileText size={17} />} testId="stat-batches" />
            <StatCard title="Recipients" value={overview?.recipientCount ?? 0} icon={<UsersRound size={17} />} testId="stat-recipients" />
            <StatCard title="Downloads" value={overview?.downloadCount ?? 0} icon={<ArrowDownToLine size={17} />} testId="stat-downloads" />
          </section>
        )}

        {(formError || successMessage) && <div className={`mt-6 flex items-start gap-2 rounded-lg p-3.5 text-sm ${formError ? 'border border-[#ecd2cc] bg-[#fbf0ed] text-[#9a473a]' : 'border border-[#d3e3d5] bg-[#edf5ed] text-[#346348]'}`} role={formError ? 'alert' : 'status'} data-testid={formError ? 'status-admin-error' : 'status-admin-success'}>{formError ? <CircleAlert size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0" />}{formError || successMessage}</div>}
        {(managementError || managementSuccess) && <div className={`mt-3 flex items-start gap-2 rounded-lg p-3.5 text-sm ${managementError ? 'border border-[#ecd2cc] bg-[#fbf0ed] text-[#9a473a]' : 'border border-[#d3e3d5] bg-[#edf5ed] text-[#346348]'}`} role={managementError ? 'alert' : 'status'} data-testid={managementError ? 'status-management-error' : 'status-management-success'}>{managementError ? <CircleAlert size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0" />}{managementError || managementSuccess}</div>}

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[.84fr_1.16fr]">
          <section className="admin-card" aria-labelledby="institutions-heading">
            <div className="admin-card-heading"><span className="icon-tile"><Building2 size={18} /></span><div><h2 id="institutions-heading">Institutions</h2><p>Add an institution to the public search.</p></div></div>
            <form onSubmit={submitInstitution} className="mt-6">
              <label htmlFor="institution-name" className="field-label">Institution name</label>
              <input id="institution-name" className="form-control mt-2" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} placeholder="e.g. University or training centre" minLength={2} maxLength={160} required data-testid="input-institution-name" />
              <button type="submit" className="secondary-button mt-3 w-full justify-center" disabled={createInstitution.isPending} data-testid="button-add-institution">
                {createInstitution.isPending ? 'Adding institution…' : 'Add institution'} <ArrowRight size={14} />
              </button>
            </form>
            <div className="mt-7 border-t border-[#ebe5da] pt-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Your institutions</h3><span className="rounded-full bg-[#f0ede4] px-2 py-1 text-[10px] font-semibold text-[#66756c]" data-testid="text-institution-count">{institutions.length}</span></div>
              <label className="relative mb-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#859087]" /><input className="form-control pl-9" value={institutionSearch} onChange={(event) => setInstitutionSearch(event.target.value)} placeholder="Search institutions" aria-label="Search institutions" data-testid="input-institution-search" /></label>
              {institutionsQuery.isLoading ? <div className="space-y-2"><div className="h-12 animate-pulse rounded-lg bg-[#f0ede5]" /><div className="h-12 animate-pulse rounded-lg bg-[#f0ede5]" /></div>
                : institutionsQuery.isError ? <QueryNotice text="Institutions could not be loaded." onRetry={() => institutionsQuery.refetch()} testId="status-admin-institutions-error" />
                  : filteredInstitutions.length ? <ul className="space-y-2">{filteredInstitutions.map((institution) => <li key={institution.id} className="institution-row flex-wrap" data-testid={`row-institution-${institution.id}`}>
                    {editingInstitution === institution.id ? <div className="flex w-full flex-wrap items-center gap-2">
                      <input className="form-control min-w-[180px] flex-1" value={institutionDraft} onChange={(event) => setInstitutionDraft(event.target.value)} maxLength={160} data-testid={`input-rename-institution-${institution.id}`} />
                      <button className="secondary-button min-h-9 px-3" onClick={() => void renameInstitution(institution.id)} disabled={updateInstitution.isPending} data-testid={`button-save-institution-${institution.id}`}><Save size={14} /> Save</button>
                      <button className="text-xs font-semibold text-[#718078]" onClick={() => setEditingInstitution(null)} data-testid={`button-cancel-institution-${institution.id}`}>Cancel</button>
                    </div> : <>
                      <span className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e9efe8] text-[#416953]"><Landmark size={15} /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#334c41]" data-testid={`text-institution-name-${institution.id}`}>{institution.name}</span><span className="mt-0.5 block text-[10px] text-[#7c877f]" data-testid={`text-institution-batches-${institution.id}`}>{institution.batchCount} {institution.batchCount === 1 ? 'batch' : 'batches'}</span></span></span>
                      <div className="flex items-center gap-1"><button className="flex h-8 w-8 items-center justify-center rounded-md text-[#557362] hover:bg-[#edf2ec]" aria-label={`Rename ${institution.name}`} onClick={() => { setInstitutionDraft(institution.name); setEditingInstitution(institution.id); }} data-testid={`button-edit-institution-${institution.id}`}><Pencil size={14} /></button><button className="flex h-8 w-8 items-center justify-center rounded-md text-[#a34b3d] hover:bg-[#fbefec]" aria-label={`Delete ${institution.name}`} onClick={() => void removeInstitution(institution.id, institution.name)} data-testid={`button-delete-institution-${institution.id}`}><Trash2 size={14} /></button></div>
                    </>}
                  </li>)}</ul>
                    : <div className="empty-mini"><Landmark size={17} /><span>{institutions.length ? 'No institutions match that search.' : 'No institutions added yet.'}</span></div>}
            </div>
          </section>

          <section className="admin-card" aria-labelledby="batch-heading">
            <div className="admin-card-heading"><span className="icon-tile icon-tile-gold"><Sparkles size={18} /></span><div><h2 id="batch-heading">Publish a certificate batch</h2><p>Attach a template and add its recipient names.</p></div></div>
            <form onSubmit={submitBatch} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="field-label">Institution</span><span className="relative mt-2 block"><select className="form-control appearance-none pr-9" value={selectedInstitution} onChange={(event) => setSelectedInstitution(event.target.value)} required data-testid="select-admin-institution"><option value="">Select institution</option>{institutions.map((institution) => <option value={institution.id} key={institution.id}>{institution.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b877e]" /></span></label>
                <label><span className="field-label">Batch title</span><input className="form-control mt-2" value={batchTitle} onChange={(event) => setBatchTitle(event.target.value)} placeholder="e.g. November 2025 cohort" minLength={2} maxLength={160} required data-testid="input-batch-title" /></label>
              </div>
              <label className="block">
                <span className="field-label">Certificate template</span>
                <label className={`upload-field mt-2 ${template ? 'upload-field-ready' : ''}`}>
                  <input id="template-file" className="sr-only" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(event) => { setTemplate(event.target.files?.[0] ?? null); setFormError(''); }} data-testid="input-template-file" />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f0ede3] text-[#687c6c]">{template ? <FileImage size={19} /> : <Upload size={19} />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#365143]">{template?.name ?? 'Choose a template file'}</span><span className="mt-1 block text-xs text-[#808b82]">{template ? `${(template.size / 1024 / 1024).toFixed(1)} MB · ${template.type || 'template'}` : 'PDF, PNG or JPEG · private upload · max 20 MB'}</span></span>
                  <span className="file-picker-label">{template ? 'Change' : 'Browse'}</span>
                </label>
              </label>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="recipient-names" className="field-label">Recipient full names</label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#426650] hover:underline">
                      <input id="recipient-file" type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={importNamesFile} data-testid="input-recipient-file" />
                      <Upload size={13} /> Import CSV or text
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-[#7a857e]">{recipientFileName ? `Imported from ${recipientFileName}. Review the names before publishing.` : 'Paste one exact full name per line, or import a one-column CSV / text file. Names are not shown publicly.'}</p>
                  <textarea id="recipient-names" className="form-control mt-2 min-h-[124px] resize-y py-3 leading-6" value={recipientText} onChange={(event) => { setRecipientText(event.target.value); setRecipientFileName(''); }} placeholder="One exact full name per line" data-testid="input-recipient-names" required />
                </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ebe5da] pt-4">
                <span className="text-xs text-[#7a857e]">{recipientText.split(/\r?\n/).filter((line) => line.trim()).length} names in this batch · searchable by name</span>
                <button type="submit" className="primary-button justify-center" disabled={busy || createBatch.isPending} data-testid="button-create-batch">
                  {busy ? <><span className="button-shimmer">Uploading & publishing…</span></> : <>Create batch <ArrowRight size={15} /></>}
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="mt-8 admin-card" aria-labelledby="recent-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 id="recent-heading" className="text-base font-semibold text-[#29463b]">Recent batches</h2><p className="mt-1 text-xs text-[#7d877f]">Recently published certificate collections.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3efe4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#857346]"><FileText size={12} /> Private templates</span></div>
          {batchesQuery.isLoading ? <div className="space-y-2"><div className="h-14 animate-pulse rounded-lg bg-[#f0ede5]" /><div className="h-14 animate-pulse rounded-lg bg-[#f0ede5]" /></div>
            : batchesQuery.isError ? <QueryNotice text="Batches could not be loaded." onRetry={() => batchesQuery.refetch()} testId="status-batches-error" />
               : batchesQuery.data?.length ? <div className="overflow-x-auto"><table className="admin-table w-full min-w-[800px] text-left"><thead><tr><th>Batch</th><th>Institution</th><th>Recipients</th><th>Created</th><th>Template</th><th>Manage</th></tr></thead><tbody>{batchesQuery.data.map((batch) => <tr key={batch.id} data-testid={`row-batch-${batch.id}`}>
                 {editingBatch === batch.id ? <>
                   <td><input className="form-control min-w-[170px]" value={batchDraft.title} onChange={(event) => setBatchDraft({ ...batchDraft, title: event.target.value })} data-testid={`input-edit-batch-title-${batch.id}`} /></td>
                   <td><select className="form-control min-w-[180px]" value={batchDraft.institutionId} onChange={(event) => setBatchDraft({ ...batchDraft, institutionId: event.target.value })} data-testid={`select-edit-batch-institution-${batch.id}`}>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select></td>
                   <td>{batch.recipientCount.toLocaleString()}</td><td>{new Date(batch.createdAt).toLocaleDateString()}</td><td>{batch.templateFilename}</td>
                   <td><div className="flex gap-1"><button className="secondary-button min-h-8 px-2" onClick={() => void saveBatch(batch.id)} disabled={updateBatch.isPending} data-testid={`button-save-batch-${batch.id}`}><Save size={13} /> Save</button><button className="text-xs" onClick={() => setEditingBatch(null)} data-testid={`button-cancel-batch-${batch.id}`}>Cancel</button></div></td>
                 </> : <>
                   <td className="font-semibold text-[#344e42]" data-testid={`text-batch-title-${batch.id}`}>{batch.title}</td><td data-testid={`text-batch-institution-${batch.id}`}>{batch.institutionName}</td><td data-testid={`text-batch-recipient-count-${batch.id}`}>{batch.recipientCount.toLocaleString()}</td><td>{new Date(batch.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><span className="inline-flex items-center gap-1.5"><FileText size={13} />{batch.templateFilename}</span></td>
                   <td><div className="flex flex-wrap gap-1"><button className="text-xs font-semibold text-[#416953] hover:underline" onClick={() => { setBatchDraft({ title: batch.title, institutionId: batch.institutionId }); setEditingBatch(batch.id); }} data-testid={`button-edit-batch-${batch.id}`}>Edit</button><button className="text-xs font-semibold text-[#416953] hover:underline" onClick={() => { setSelectedBatchForRecipients(batch.id); setEditingRecipient(null); setNewRecipientNames(''); setRecipientSearch(''); setManagementError(''); setManagementSuccess(''); }} data-testid={`button-open-recipients-${batch.id}`}>Recipients</button><button className="text-xs font-semibold text-[#a34b3d] hover:underline" onClick={() => void removeBatch(batch.id, batch.title)} data-testid={`button-delete-batch-${batch.id}`}>Delete</button></div></td>
                 </>}
               </tr>)}</tbody></table></div>
                : <div className="empty-batches"><span className="empty-seal"><FileText size={21} /></span><div><h3>No batches yet</h3><p>When you create the first batch, it will appear here.</p></div></div>}
        </section>
        {selectedBatchForRecipients && <section className="mt-8 admin-card" aria-labelledby="recipients-heading" data-testid="panel-batch-recipients">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow"><span className="eyebrow-mark" /> Recipient records</p><h2 id="recipients-heading" className="serif mt-2 text-2xl tracking-[-.04em] text-[#203c35]">{selectedBatch?.title ?? 'Batch recipients'}</h2><p className="mt-1 text-xs text-[#758078]">{selectedBatch?.institutionName} · names are held in administrator records only</p></div>
            <button className="secondary-button min-h-9" onClick={() => { setSelectedBatchForRecipients(''); setNewRecipientNames(''); setRecipientSearch(''); }} data-testid="button-close-recipients"><X size={14} /> Close list</button>
          </div>
          <form onSubmit={submitAdditionalRecipients} className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label><span className="field-label">Add multiple full names</span><textarea className="form-control mt-2 min-h-[90px] resize-y py-3 leading-6" value={newRecipientNames} onChange={(event) => setNewRecipientNames(event.target.value)} placeholder={'One full name per line'} data-testid="input-add-recipient-names" /></label>
            <button className="primary-button min-h-[46px] justify-center" type="submit" disabled={addRecipients.isPending} data-testid="button-add-recipients">{addRecipients.isPending ? 'Adding names…' : <>Add names <Users size={14} /></>}</button>
          </form>
          <label className="relative mb-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#859087]" /><input className="form-control pl-9" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Find a recipient by name" aria-label="Find a recipient by name" data-testid="input-recipient-search" /></label>
          {recipientsQuery.isLoading ? <div className="space-y-2"><div className="h-12 animate-pulse rounded-lg bg-[#f0ede5]" /><div className="h-12 animate-pulse rounded-lg bg-[#f0ede5]" /></div>
            : recipientsQuery.isError ? <QueryNotice text="Recipient records could not be loaded." onRetry={() => recipientsQuery.refetch()} testId="status-recipients-error" />
              : recipientsQuery.data?.length && filteredRecipients.length ? <ul className="divide-y divide-[#eee9df] rounded-lg border border-[#eee9df]" data-testid="list-batch-recipients">{filteredRecipients.map((recipient) => <li key={recipient.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3" data-testid={`row-recipient-${recipient.id}`}>
                {editingRecipient === recipient.id ? <div className="flex w-full flex-wrap items-center gap-2"><input className="form-control min-w-[190px] flex-1" value={recipientDraft} onChange={(event) => setRecipientDraft(event.target.value)} maxLength={180} data-testid={`input-edit-recipient-${recipient.id}`} /><button className="secondary-button min-h-9 px-3" onClick={() => void saveRecipient(recipient.id)} disabled={updateRecipient.isPending} data-testid={`button-save-recipient-${recipient.id}`}><Save size={14} /> Save</button><button className="text-xs font-semibold text-[#718078]" onClick={() => setEditingRecipient(null)} data-testid={`button-cancel-recipient-${recipient.id}`}>Cancel</button></div> : <>
                  <span className="text-sm font-medium text-[#334c41]" data-testid={`text-recipient-name-${recipient.id}`}>{recipient.fullName}</span>
                  <span className="flex items-center gap-1"><button className="flex h-8 w-8 items-center justify-center rounded-md text-[#557362] hover:bg-[#edf2ec]" aria-label={`Edit ${recipient.fullName}`} onClick={() => { setRecipientDraft(recipient.fullName); setEditingRecipient(recipient.id); }} data-testid={`button-edit-recipient-${recipient.id}`}><Pencil size={14} /></button><button className="flex h-8 w-8 items-center justify-center rounded-md text-[#a34b3d] hover:bg-[#fbefec]" aria-label={`Delete ${recipient.fullName}`} onClick={() => void removeRecipient(recipient.id, recipient.fullName)} data-testid={`button-delete-recipient-${recipient.id}`}><Trash2 size={14} /></button></span>
                </>}</li>)}</ul>
                : <div className="empty-batches" data-testid="status-no-recipients"><span className="empty-seal"><Users size={19} /></span><div><h3>{recipientsQuery.data?.length ? 'No recipients match that search' : 'No recipient records in this batch'}</h3><p>{recipientsQuery.data?.length ? 'Try another part of the recipient name.' : 'Add full names above to make them searchable through the public portal.'}</p></div></div>}
        </section>}
        <section className="mt-8 admin-card" aria-labelledby="name-style-heading">
          <div className="admin-card-heading"><span className="icon-tile icon-tile-gold"><Pencil size={17} /></span><div><h2 id="name-style-heading">Certificate name style</h2><p>One global print style for recipient names across all certificates.</p></div></div>
          <p className="mt-4 max-w-3xl text-xs leading-5 text-[#77837b]">This only changes how the recipient name is rendered. Your uploaded template artwork remains untouched.</p>
          {styleQuery.isLoading ? <div className="mt-5 h-24 animate-pulse rounded-lg bg-[#f0ede5]" data-testid="skeleton-name-style" /> :
            styleQuery.isError ? <QueryNotice text="Global name style could not be loaded." onRetry={() => styleQuery.refetch()} testId="status-name-style-error" /> :
              <form onSubmit={saveNameStyle} className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label><span className="field-label">Font family</span><select className="form-control mt-2" value={nameStyleDraft.fontFamily} onChange={(event) => setNameStyleDraft({ ...nameStyleDraft, fontFamily: event.target.value })} data-testid="select-name-font"><option value="helvetica">Helvetica</option><option value="helveticaBold">Helvetica Bold</option><option value="timesRoman">Times Roman</option><option value="timesRomanBold">Times Roman Bold</option><option value="courier">Courier</option><option value="courierBold">Courier Bold</option></select></label>
                  <label><span className="field-label">Text color</span><span className="mt-2 flex gap-2"><input type="color" className="h-[46px] w-14 cursor-pointer rounded-lg border border-[#ded8cc] bg-[#fffefa] p-1" value={nameStyleDraft.textColor} onChange={(event) => setNameStyleDraft({ ...nameStyleDraft, textColor: event.target.value })} aria-label="Choose recipient name text color" data-testid="input-name-color-picker" /><input className="form-control font-mono" value={nameStyleDraft.textColor} onChange={(event) => setNameStyleDraft({ ...nameStyleDraft, textColor: event.target.value })} pattern="^#[0-9a-fA-F]{6}$" data-testid="input-name-color" /></span></label>
                  <label><span className="field-label">Font size <span className="font-normal text-[#7c877f]">({nameStyleDraft.fontSize} pt)</span></span><input type="range" className="mt-4 w-full accent-[#315b48]" min={12} max={72} step={1} value={nameStyleDraft.fontSize} onChange={(event) => setNameStyleDraft({ ...nameStyleDraft, fontSize: Number(event.target.value) })} data-testid="input-name-font-size" /><span className="flex justify-between text-[10px] text-[#849087]"><span>12 pt</span><span>72 pt</span></span></label>
                </div>
                <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#e6e0d4] bg-[#f8f5ec] p-4">
                  <div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#95804a]">Name preview</span><div className="mt-3 flex min-h-[78px] items-center justify-center overflow-hidden rounded-md border border-dashed border-[#d8d0bf] bg-[#fffdf8] px-2 text-center" style={{ color: nameStyleDraft.textColor, fontSize: `${Math.min(nameStyleDraft.fontSize, 34)}px`, fontFamily: nameStyleDraft.fontFamily.startsWith('times') ? 'Georgia, serif' : nameStyleDraft.fontFamily.startsWith('courier') ? 'monospace' : 'Arial, sans-serif', fontWeight: nameStyleDraft.fontFamily.endsWith('Bold') ? 700 : 400 }} data-testid="preview-certificate-name">Amina Owusu</div></div>
                  <button className="primary-button justify-center" type="submit" disabled={updateNameStyle.isPending} data-testid="button-save-name-style">{updateNameStyle.isPending ? 'Saving style…' : <>Save global style <Save size={14} /></>}</button>
                </div>
              </form>}
          {styleQuery.data?.updatedAt && <p className="mt-3 text-[10px] text-[#879188]" data-testid="text-name-style-updated">Last saved {new Date(styleQuery.data.updatedAt).toLocaleString()}</p>}
        </section>
        {overview?.recentBatches && overview.recentBatches.length > 0 && batchesQuery.isError && <div className="sr-only">{overview.recentBatches.length} recent batches</div>}
      </main>
      <footer className="border-t border-[#e1dbce] bg-[#f1eee5]"><div className="page-width flex items-center justify-between py-5 text-[11px] text-[#7d877f]"><span>MeritMark · Administrator console</span><Link href="/" className="font-semibold text-[#3d6651]" data-testid="link-admin-footer-home">Return to public search</Link></div></footer>
    </div>
  );
}

function StatCard({ title, value, icon, testId }: { title: string; value: number; icon: ReactNode; testId: string }) {
  return <article className="stat-card" data-testid={testId}><span className="stat-icon">{icon}</span><span className="mt-3 block text-xs font-medium text-[#748078]">{title}</span><span className="mt-1 block text-[28px] font-semibold tracking-[-.05em] text-[#24483c]" data-testid={`${testId}-value`}>{value.toLocaleString()}</span></article>;
}

function AdminStatsSkeleton() {
  return <div className="stats-grid">{[1, 2, 3, 4].map((item) => <div className="stat-card" key={item}><div className="h-8 w-8 animate-pulse rounded-lg bg-[#e9e5da]" /><div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#e9e5da]" /><div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#e9e5da]" /></div>)}</div>;
}

function AdminLoading() {
  return <div className="min-h-[100dvh] bg-[#f6f3eb]"><SiteHeader /><div className="page-width py-12"><div className="h-8 w-64 animate-pulse rounded bg-[#e8e3d8]" /><div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-[#e8e3d8]" />)}</div><div className="mt-8 h-72 animate-pulse rounded-xl bg-[#e8e3d8]" /></div></div>;
}

function SignInPage() {
  return <div className="auth-screen"><div className="auth-brand"><Link href="/" className="flex items-center gap-3" data-testid="link-auth-logo"><BrandMark /><span><span className="block font-semibold text-[#203c35]">MeritMark</span><span className="block text-[9px] uppercase tracking-[.2em] text-[#839087]">Ghana certificate portal</span></span></Link></div><div className="auth-aside"><div className="auth-aside-content"><BrandMark inverse /><p className="mt-8 text-[10px] font-semibold uppercase tracking-[.2em] text-[#d4c286]">Administrator access</p><h1 className="serif mt-4 text-4xl leading-tight text-[#faf7ed]">Good work deserves<br /><em className="font-normal text-[#d7c68e]">a lasting record.</em></h1><p className="mt-5 max-w-sm text-sm leading-6 text-[#cad8ce]">A considered space to manage institutions, certificate templates and recipient records.</p></div></div><div className="auth-form-pane"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="auth-screen"><div className="auth-brand"><Link href="/" className="flex items-center gap-3" data-testid="link-auth-logo"><BrandMark /><span><span className="block font-semibold text-[#203c35]">MeritMark</span><span className="block text-[9px] uppercase tracking-[.2em] text-[#839087]">Ghana certificate portal</span></span></Link></div><div className="auth-aside"><div className="auth-aside-content"><BrandMark inverse /><p className="mt-8 text-[10px] font-semibold uppercase tracking-[.2em] text-[#d4c286]">MeritMark portal</p><h1 className="serif mt-4 text-4xl leading-tight text-[#faf7ed]">A secure home for<br /><em className="font-normal text-[#d7c68e]">your next step.</em></h1><p className="mt-5 max-w-sm text-sm leading-6 text-[#cad8ce]">Sign in to continue to the MeritMark administrator console.</p></div></div><div className="auth-form-pane"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function RoutedApp() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to manage the certificate portal' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Administrator access is allowlisted' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><RoutedApp /></WouterRouter>;
}

export default App;
