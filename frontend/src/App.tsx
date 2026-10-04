import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  User,
  Building2,
  Mail,
  Cpu,
  FileText,
  DollarSign,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  Copy,
  ExternalLink,
  RotateCcw,
  Check,
  Calculator,
  CheckCircle,
  Star,
  Quote,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  X
} from 'lucide-react';
import { submitClientRequest, QuoteResponse } from './services/api';

interface FormData {
  fullName: string;
  companyName: string;
  email: string;
  projectType: string;
  projectDescription: string;
  budgetRange: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  projectType?: string;
  projectDescription?: string;
  submitError?: string;
}

interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  service: string;
  quote: string;
  rating: number;
  initials: string;
  avatarBg: string;
  highlightMetric: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Marc Dubois',
    role: 'Chief Technology Officer',
    company: 'CloudScale Logistics',
    service: 'AI Automation',
    quote:
      'Ghassen architected an automated multi-agent extraction pipeline that cut our document processing time by 82%. His code is exceptionally clean, bulletproof in production, and saved us hundreds of manual hours.',
    rating: 5,
    initials: 'MD',
    avatarBg: 'bg-blue-600',
    highlightMetric: '82% faster document pipeline',
  },
  {
    id: 2,
    name: 'Elena Rostova',
    role: 'Head of Product',
    company: 'Finova Technologies',
    service: 'Web Development',
    quote:
      'Working with Ghassen was seamless from technical discovery to deployment. He delivered our enterprise web application ahead of schedule with remarkable UI precision, responsiveness, and zero rework required.',
    rating: 5,
    initials: 'ER',
    avatarBg: 'bg-indigo-600',
    highlightMetric: 'Delivered ahead of schedule',
  },
  {
    id: 3,
    name: 'David Chen',
    role: 'Managing Partner',
    company: 'Omnis Applied AI',
    service: 'Consultation & Architecture',
    quote:
      'Ghassen cut through the AI hype to design a realistic, high-throughput LLM workflow tailored specifically to our enterprise constraints. His consultation gave our engineering team total clarity and saved months of R&D trial.',
    rating: 5,
    initials: 'DC',
    avatarBg: 'bg-emerald-600',
    highlightMetric: 'Saved months of R&D trial',
  },
];

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    companyName: '',
    email: '',
    projectType: 'AI Automation',
    projectDescription: '',
    budgetRange: '$5k - $10k',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStageText, setCalculationStageText] = useState('Analyzing parameters...');
  const [quoteResult, setQuoteResult] = useState<QuoteResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Client Testimonials carousel state
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Auto-slide testimonials every 5.5s unless hovered
  useEffect(() => {
    if (isCarouselPaused) return;
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  const handlePrevTestimonial = () => {
    setActiveTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  // Determine current active step: 1 = Form Entry, 2 = Calculation, 3 = Final Result
  const currentStep = quoteResult ? 3 : isSubmitting ? 2 : 1;

  // Validate fields
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your complete name';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid email address';
    }

    if (!formData.projectType) {
      newErrors.projectType = 'Please select a project type';
    }

    if (!formData.projectDescription.trim()) {
      newErrors.projectDescription = 'Project description is required';
    } else if (formData.projectDescription.trim().length < 15) {
      newErrors.projectDescription = 'Please provide a bit more detail (min 15 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors] || errors.submitError) {
      setErrors((prev) => ({ ...prev, [name]: undefined, submitError: undefined }));
    }
  };

  const handleBudgetChange = (budget: string) => {
    setFormData((prev) => ({ ...prev, budgetRange: budget }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setCalculationProgress(15);
    setCalculationStageText('Parsing project requirements and scope...');

    const stageTimer1 = setTimeout(() => {
      setCalculationProgress(45);
      setCalculationStageText(`Evaluating technical complexity for ${formData.projectType}...`);
    }, 400);

    const stageTimer2 = setTimeout(() => {
      setCalculationProgress(75);
      setCalculationStageText('Running AI estimation and generating proposal...');
    }, 900);

    try {
      // Clean and sanitize inputs client-side before sending
      const cleanName = DOMPurify.sanitize(formData.fullName.trim());
      const cleanCompany = DOMPurify.sanitize(formData.companyName.trim());
      const cleanEmail = DOMPurify.sanitize(formData.email.trim());
      const cleanDescription = DOMPurify.sanitize(formData.projectDescription.trim());

      const apiPayload = {
        client_name: cleanName,
        company_name: cleanCompany,
        email: cleanEmail,
        project_type: formData.projectType,
        description: cleanDescription,
        budget_range: formData.budgetRange,
      };

      const result = await submitClientRequest(apiPayload);

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setCalculationProgress(100);
      setCalculationStageText('Consultation proposal finalized.');

      setTimeout(() => {
        setIsSubmitting(false);
        setQuoteResult(result);
        // Automatically open booking modal on successful quote generation
        setIsBookingModalOpen(true);
      }, 400);

    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsSubmitting(false);
      setCalculationProgress(0);
      setErrors((prev) => ({
        ...prev,
        submitError: err.message || 'An unexpected error occurred while submitting your request.',
      }));
    }
  };

  const handleFillDemo = () => {
    setFormData({
      fullName: 'Ghassen Ben Taher',
      companyName: 'Apex Logistics Inc.',
      email: 'bentaherghassen@apexlogistics.com',
      projectType: 'AI Automation',
      projectDescription: 'We need an automated AI agent system that parses incoming PDF shipment invoices, extracts tracking numbers and customs codes, and syncs directly into our ERP system with automated error flags.',
      budgetRange: '$5k - $10k',
    });
    setErrors({});
  };

  const handleResetForm = () => {
    setQuoteResult(null);
    setIsSubmitting(false);
    setCalculationProgress(0);
    setFormData({
      fullName: '',
      companyName: '',
      email: '',
      projectType: 'AI Automation',
      projectDescription: '',
      budgetRange: '$5k - $10k',
    });
    setErrors({});
  };

  const handleModifyDetails = () => {
    setQuoteResult(null);
    setIsSubmitting(false);
    setCalculationProgress(0);
  };

  const handleCopyQuote = () => {
    if (!quoteResult) return;
    const textToCopy = `
GHASSEN BEN TAHER - BUSINESS REQUEST & CONSULTATION
Reference ID: ${quoteResult.reference_id}
Client: ${quoteResult.client_name} (${quoteResult.company_name || 'Individual'})
Email: ${quoteResult.email}
Project Type: ${quoteResult.project_type}
Estimated Budget: ${quoteResult.budget_range}
Estimated Timeline: ${quoteResult.estimated_timeline}
Consultation Range: ${quoteResult.formatted_price}

Project Scope:
${quoteResult.description}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const mailtoLink = quoteResult
    ? `mailto:bentaherghassen@gmail.com?subject=${encodeURIComponent(
        `Business Request [${quoteResult.reference_id}]: ${quoteResult.project_type} - ${quoteResult.client_name}`
      )}&body=${encodeURIComponent(
        `Hello Ghassen,\n\nI have submitted a business request via your consultation portal.\n\nReference: ${quoteResult.reference_id}\nClient: ${quoteResult.client_name}\nCompany: ${quoteResult.company_name || 'N/A'}\nEmail: ${quoteResult.email}\nProject Type: ${quoteResult.project_type}\nBudget Range: ${quoteResult.budget_range}\nEstimate: ${quoteResult.formatted_price}\n\nProject Scope:\n${quoteResult.description}\n\nLooking forward to our consultation call.`
      )}`
    : '#';

  // Multi-step progress bar definition
  const steps = [
    {
      number: 1,
      title: 'Form Entry',
      subtitle: 'Project Details',
      icon: FileText,
    },
    {
      number: 2,
      title: 'Calculation',
      subtitle: 'Scoping & Estimate',
      icon: Calculator,
    },
    {
      number: 3,
      title: 'Final Result',
      subtitle: 'Quote & Booking',
      icon: CheckCircle2,
    },
  ];

  // Helper to safely render user content using DOMPurify
  const sanitizedDisplay = (text: string) => {
    return DOMPurify.sanitize(text);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-slate-50 to-gray-100 font-['Ubuntu',sans-serif] text-gray-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Left side: Ghassen ben Taher in large, bold primary-colored font */}
          <div className="flex items-center gap-3">
  <img 
    src="assets//bentaherghassen.jpg" 
    alt="Ghassen ben Taher" 
    className="w-10 h-10 rounded-xl object-cover shadow-md shadow-blue-500/27 border border-blue-100"
  />
  <div>
    <h1 className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight leading-none">
      Ghassen ben Taher
    </h1>

              <p className="text-xs text-gray-500 font-normal mt-0.5 sm:hidden">
                AI Automation Specialist & Software Engineer
              </p>
            </div>
          </div>

          {/* Right side: Professional title / What he does */}
          <div className="hidden sm:flex items-center gap-3 text-right">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800 tracking-tight">
                Python Backend Developer | Django & Flask Specialist | FastAPI | REST APIs | AI & Automation | Accessibility Advocate
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Available for New Projects & Contracts
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 flex items-center justify-center py-8 sm:py-12 md:py-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl">
          {/* Card Element */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 shadow-xl border border-gray-100 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-100/80 relative">
            
            {/* Subtle Top Decorative Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-t-2xl"></div>

            {/* MULTI-STEP PROGRESS BAR COMPONENT */}
            <div className="mb-8 pt-2">
              <div className="relative">
                {/* Connecting Line Track */}
                <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 z-0 rounded-full hidden sm:block"></div>
                
                {/* Active Connecting Fill Line */}
                <div
                  className="absolute top-5 left-8 h-1 bg-blue-600 z-0 rounded-full transition-all duration-500 ease-out hidden sm:block"
                  style={{
                    width:
                      currentStep === 1
                        ? '0%'
                        : currentStep === 2
                        ? 'calc(50% - 16px)'
                        : 'calc(100% - 64px)',
                  }}
                ></div>

                {/* Steps Grid */}
                <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  {steps.map((step) => {
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;
                    const IconComponent = step.icon;

                    return (
                      <div
                        key={step.number}
                        className="flex flex-col items-center group transition-all"
                      >
                        {/* Circle Indicator */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                              : isCurrent
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md shadow-blue-500/25 scale-105'
                              : 'bg-white border-2 border-gray-300 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-5 h-5 stroke-[2.5]" />
                          ) : (
                            <IconComponent className="w-4 h-4" />
                          )}
                        </div>

                        {/* Step Title & Subtitle */}
                        <div className="mt-2.5">
                          <div
                            className={`text-xs sm:text-sm font-bold tracking-tight transition-colors duration-200 ${
                              isCurrent
                                ? 'text-blue-600'
                                : isCompleted
                                ? 'text-gray-900'
                                : 'text-gray-400'
                            }`}
                          >
                            <span className="sm:hidden">{step.number}. </span>
                            {step.title}
                          </div>
                          <div
                            className={`text-[11px] hidden sm:block font-normal mt-0.5 ${
                              isCurrent
                                ? 'text-blue-500 font-medium'
                                : isCompleted
                                ? 'text-gray-500'
                                : 'text-gray-400'
                            }`}
                          >
                            {step.subtitle}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step Status Banner */}
              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="text-gray-400">Step {currentStep} of 3:</span>
                  <span className="text-blue-600 font-semibold">
                    {steps[currentStep - 1]?.title}
                  </span>
                </div>
                {currentStep === 1 && (
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                    title="Auto-fill with sample details"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Fill sample request
                  </button>
                )}
                {currentStep === 3 && (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Complete
                  </span>
                )}
              </div>
            </div>

            {/* ERROR BANNER */}
            {errors.submitError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-red-900">Submission Error</h4>
                  <p className="mt-0.5 text-xs text-red-700 leading-relaxed">{errors.submitError}</p>
                </div>
                <button
                  onClick={() => setErrors((prev) => ({ ...prev, submitError: undefined }))}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: CALCULATION IN PROGRESS STATE */}
            {isSubmitting && (
              <div className="py-10 px-4 text-center space-y-6 animate-in fade-in duration-300">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-inner">
                    <Calculator className="w-10 h-10 animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-3.5 w-3.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600"></span>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                    Calculating Consultation Scope & Estimate
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                    Communicating with Django API for <strong className="text-gray-900">{formData.projectType}</strong> under budget bracket <strong className="text-gray-900">{formData.budgetRange}</strong>...
                  </p>
                </div>

                {/* Animated Progress Bar */}
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${calculationProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
                    <span className="text-blue-600 font-medium font-sans">
                      {calculationStageText}
                    </span>
                    <span>{calculationProgress}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: FINAL RESULT STATE */}
            {!isSubmitting && quoteResult && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-5 text-emerald-900">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg text-emerald-900">
                        Request Received & Quote Generated!
                      </h3>
                      <p className="text-sm text-emerald-700 mt-1 leading-normal">
                        Thank you, <strong className="font-semibold">{sanitizedDisplay(quoteResult.client_name)}</strong>. Your inquiry has been processed and logged under reference <code className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-xs">{quoteResult.reference_id}</code>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scope & Estimate Summary */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-5 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Preliminary Consultation Assessment
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-3.5 rounded-lg border border-gray-200/80 shadow-xs">
                      <span className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" /> Estimated Timeline
                      </span>
                      <span className="font-bold text-gray-900 text-base">
                        {quoteResult.estimated_timeline}
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-gray-200/80 shadow-xs">
                      <span className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-blue-600" /> AI Estimated Quote
                      </span>
                      <span className="font-bold text-gray-900 text-base text-blue-600">
                        {quoteResult.formatted_price}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200/80 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Service Track:</span>
                      <span className="font-semibold text-gray-900">{quoteResult.project_type}</span>
                    </div>
                    {quoteResult.company_name && (
                      <div className="flex justify-between border-b border-gray-100 pb-2">
                        <span className="text-gray-500">Company:</span>
                        <span className="font-semibold text-gray-900">{sanitizedDisplay(quoteResult.company_name)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Contact Email:</span>
                      <span className="font-semibold text-gray-900">{sanitizedDisplay(quoteResult.email)}</span>
                    </div>
                    <div className="pt-1">
                      <span className="text-gray-500 block text-xs mb-1">Sanitized Project Brief:</span>
                      <p className="text-gray-800 text-xs sm:text-sm bg-gray-50 p-2.5 rounded border border-gray-100 leading-relaxed italic">
                        "{sanitizedDisplay(quoteResult.description)}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* PDF & Booking Primary Call-to-Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  {quoteResult.pdf_url && (
                    <a
                      href={quoteResult.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition shadow-md text-sm text-center"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      Download PDF Quote Bill
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md text-sm text-center cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    Book Consultation Call
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={mailtoLink}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-700 active:scale-[0.99] transition shadow-xs text-xs text-center"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Direct Email
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyQuote}
                    className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-50 transition text-xs cursor-pointer shadow-xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-4 text-center pt-2">
                  <button
                    type="button"
                    onClick={handleModifyDetails}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    Edit Form Entry
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Submit new inquiry
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: FORM ENTRY STATE */}
            {!isSubmitting && !quoteResult && (
              <>
                {/* Title & Introduction */}
                <div className="mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    Request a Project Consultation & Quote
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
                    Provide your project specifications below to get an instant scope evaluation and priority consultation slot with Ghassen ben Taher.
                  </p>
                </div>

                {/* The Business Request Form */}
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* 1. Full Name & Company Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="fullName"
                        className="block text-sm font-semibold text-gray-700 mb-1.5"
                      >
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="e.g. John Doe"
                          required
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors duration-200 outline-none ${
                            errors.fullName
                              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                          }`}
                        />
                      </div>
                      {errors.fullName && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    {/* Company Name */}
                    <div>
                      <label
                        htmlFor="companyName"
                        className="block text-sm font-semibold text-gray-700 mb-1.5"
                      >
                        Company Name <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          id="companyName"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleChange}
                          placeholder="e.g. Acme Innovations"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors duration-200 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Email Address & Project Type Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email Address */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold text-gray-700 mb-1.5"
                      >
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="name@company.com"
                          required
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors duration-200 outline-none ${
                            errors.email
                              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                          }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Project Type */}
                    <div>
                      <label
                        htmlFor="projectType"
                        className="block text-sm font-semibold text-gray-700 mb-1.5"
                      >
                        Project Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <select
                          id="projectType"
                          name="projectType"
                          value={formData.projectType}
                          onChange={handleChange}
                          required
                          className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm text-gray-900 bg-white transition-colors duration-200 outline-none appearance-none cursor-pointer"
                        >
                          <option value="AI Automation">AI Automation</option>
                          <option value="Web Development">Web Development</option>
                          <option value="Consultation">Consultation</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                            <path
                              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                              clipRule="evenodd"
                              fillRule="evenodd"
                            ></path>
                          </svg>
                        </div>
                      </div>
                      {errors.projectType && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                          {errors.projectType}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3. Project Description */}
                  <div>
                    <label
                      htmlFor="projectDescription"
                      className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between items-center"
                    >
                      <span>
                        Project Description <span className="text-red-500">*</span>
                      </span>
                      <span className="text-xs font-normal text-gray-400">
                        Minimum 15 characters
                      </span>
                    </label>
                    <div className="relative">
                      <textarea
                        id="projectDescription"
                        name="projectDescription"
                        rows={4}
                        value={formData.projectDescription}
                        onChange={handleChange}
                        placeholder="Describe your goals, requirements, and desired timeline..."
                        required
                        className={`w-full p-3.5 rounded-lg border text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors duration-200 outline-none resize-y leading-relaxed ${
                          errors.projectDescription
                            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                        }`}
                      ></textarea>
                    </div>
                    {errors.projectDescription && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        {errors.projectDescription}
                      </p>
                    )}
                  </div>

                  {/* 4. Budget Range */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>
                        Budget Range <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                      </span>
                      <span className="text-xs text-blue-600 font-medium">
                        Selected: {formData.budgetRange}
                      </span>
                    </label>

                    {/* Radio Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {['$1k - $5k', '$5k - $10k', '$10k+'].map((range) => {
                        const isSelected = formData.budgetRange === range;
                        return (
                          <button
                            key={range}
                            type="button"
                            onClick={() => handleBudgetChange(range)}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-600 shadow-xs'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600'
                                    : 'border-gray-300 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                )}
                              </span>
                              <span>{range}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Trust Signals */}
                  <div className="pt-2 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Confidential NDA protected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Average reply within 24 hours</span>
                    </div>
                  </div>

                  {/* 5. Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-2 group cursor-pointer text-base sm:text-lg disabled:opacity-80"
                    >
                      <span>Submit Request & Get Instant Quote</span>
                      
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      ) : (
                        <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                      )}
                    </button>
                    <p className="mt-2 text-center text-xs text-gray-400">
                      Free estimate with zero commitment. Your information is kept strictly private.
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* BOOKING CALENDAR MODAL */}
          {isBookingModalOpen && quoteResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
                <button
                  onClick={() => setIsBookingModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Schedule Your Consultation
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Quote calculated for <strong className="text-gray-900">{quoteResult.client_name}</strong> ({quoteResult.reference_id}). Select a slot on Ghassen's calendar to review technical architecture and milestones.
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Service:</span>
                      <span className="font-semibold text-gray-900">{quoteResult.project_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Estimated Range:</span>
                      <span className="font-semibold text-emerald-700">{quoteResult.formatted_price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Timeline:</span>
                      <span className="font-semibold text-gray-900">{quoteResult.estimated_timeline}</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <a
                      href={quoteResult.booking_url || 'https://calendly.com/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md text-sm text-center"
                    >
                      <Calendar className="w-4 h-4" />
                      Open Calendly Booking Calendar
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(false)}
                      className="w-full text-xs text-gray-500 hover:text-gray-800 py-1.5 transition-colors font-medium cursor-pointer"
                    >
                      Close & Review Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Client Testimonials Carousel */}
          <section
            aria-label="Client Testimonials"
            className="mt-6 sm:mt-8 bg-white rounded-2xl p-5 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
          >
            {/* Decorative subtle background gradient blob */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-50/60 rounded-full blur-2xl pointer-events-none"></div>

            {/* Carousel Header Bar */}
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-900 tracking-tight">
                  5.0 Client Rating
                </span>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Verified Client Reviews
                </span>
              </div>

              {/* Carousel Controls: Slide Counter + Navigation Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-400 mr-1">
                  {activeTestimonial + 1} / {testimonials.length}
                </span>
                <button
                  type="button"
                  onClick={handlePrevTestimonial}
                  aria-label="Previous testimonial"
                  className="w-7 h-7 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextTestimonial}
                  aria-label="Next testimonial"
                  className="w-7 h-7 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Testimonial Card */}
            <div className="relative min-h-[130px] sm:min-h-[110px] flex flex-col justify-between">
              <div className="flex gap-3 sm:gap-4 items-start">
                <Quote className="w-7 h-7 text-blue-200 shrink-0 mt-0.5" />
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed italic font-normal">
                  "{testimonials[activeTestimonial].quote}"
                </p>
              </div>

              {/* Client Info Row */}
              <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100/80">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full ${testimonials[activeTestimonial].avatarBg} flex items-center justify-center text-white font-bold text-xs shadow-xs`}
                  >
                    {testimonials[activeTestimonial].initials}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                      {testimonials[activeTestimonial].name}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500">
                      {testimonials[activeTestimonial].role} ·{' '}
                      <span className="font-medium text-gray-700">
                        {testimonials[activeTestimonial].company}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 font-medium">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>{testimonials[activeTestimonial].highlightMetric}</span>
                </div>
              </div>
            </div>

            {/* Bottom Dot Indicators */}
            <div className="mt-4 pt-2 flex items-center justify-center gap-1.5">
              {testimonials.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTestimonial(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    activeTestimonial === index
                      ? 'w-6 bg-blue-600'
                      : 'w-2 bg-gray-200 hover:bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="mt-auto border-t border-gray-200/80 bg-white/70 backdrop-blur-xs py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="text-gray-500 text-sm">
            © Copyright 2026 - Ghassen ben taher. All Rights Reserved.
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Direct: info@bentaherghassen.com</span>
            <span>Whatsapp</span>
            <span>+21629421833</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
