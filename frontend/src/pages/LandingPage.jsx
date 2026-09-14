import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Download, 
  Chrome, 
  Shield, 
  Zap, 
  MessageCircleQuestion, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  Bot, 
  Sparkles,
  Globe,
  Lock,
  Clock,
  ChevronDown,
  Play,
  Star,
  Users,
  TrendingUp
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/80 backdrop-blur-xl border-b border-white/10' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_83598f23-6b56-44de-be74-03f8fb373d2d/artifacts/lk25akgm_Gemini_Generated_Image_ba6fpgba6fpgba6f-removebg-preview.png" 
                alt="FormWise Logo" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">FormWise</h1>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Chrome Extension</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors">How it Works</a>
              <Link to="/demo" className="text-sm text-white/70 hover:text-white transition-colors">Try Demo</Link>
            </div>
            <a 
              href={`${BACKEND_URL}/api/extension/download`}
              data-testid="nav-download-btn"
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-white/80">AI-Powered Form Assistance</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Fill Government Forms
                <span className="block bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  With Confidence
                </span>
              </h1>
              
              <p className="text-lg text-white/60 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                Your AI assistant for government forms - smart, fast, and reliable. 
                Get instant guidance on every field - know exactly what to select and why.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <a 
                  href={`${BACKEND_URL}/api/extension/download`}
              data-testid="hero-download-btn"
                  className="group flex items-center gap-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                >
                  <Chrome className="w-6 h-6" />
                  <span>Add to Chrome</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <Link 
                  to="/demo"
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-2xl text-white/80 hover:text-white transition-all"
                >
                  <Play className="w-5 h-5" />
                  <span>Try Demo</span>
                </Link>
              </div>
              
              {/* Trust Badges */}
              <div className="flex items-center gap-6 mt-10 justify-center lg:justify-start">
                <div className="flex items-center gap-2 text-white/50">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">100% Private</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-sm">Instant Help</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">Works Offline</span>
                </div>
              </div>
            </div>
            
            {/* Right - Glassmorphic Card Preview */}
            <div className="flex-1 w-full max-w-lg">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-emerald-500/30 rounded-3xl blur-2xl" />
                
                {/* Main Card */}
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-blue-500 to-emerald-500 p-3 rounded-xl">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">FormWise Guide</h3>
                      <p className="text-xs text-white/50">AI-Powered Assistance</p>
                    </div>
                  </div>
                  
                  {/* Question Card */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-emerald-500/20 p-1.5 rounded-lg">
                        <MessageCircleQuestion className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Question</span>
                    </div>
                    <p className="text-sm text-white/80 mb-4">Is applicant eligible for Non-ECR category?</p>
                    
                    {/* Options */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm text-white/90">Yes, I have 10th pass or higher</span>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                        <span className="text-sm text-white/60">No, below 10th standard</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recommendation */}
                  <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-500 p-2 rounded-lg">
                        <ArrowRight className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Select This</span>
                        <p className="text-sm font-semibold text-white mt-1">Select "Yes" for ECNR status</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/30" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Users, value: "10,000+", label: "Happy Users" },
              { icon: FileText, value: "50+", label: "Form Fields" },
              { icon: Zap, value: "<1s", label: "Response Time" },
              { icon: Star, value: "4.9", label: "User Rating" }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-white/5 rounded-xl mb-3">
                  <stat.icon className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-white/80">Powerful Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-white/60 max-w-2xl mx-auto">Smart features designed to make form filling effortless</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Bot,
                title: "AI-Powered Guidance",
                description: "Get intelligent recommendations for every form field based on your situation",
                gradient: "from-blue-500 to-cyan-500"
              },
              {
                icon: MessageCircleQuestion,
                title: "Smart Questions",
                description: "Interactive clarifying questions help you choose the right option every time",
                gradient: "from-emerald-500 to-teal-500"
              },
              {
                icon: Zap,
                title: "Instant Detection",
                description: "Automatically detects dropdowns and radio buttons - shows options instantly",
                gradient: "from-amber-500 to-orange-500"
              },
              {
                icon: Shield,
                title: "100% Private",
                description: "Your data never leaves your browser. We only analyze field labels, not your inputs",
                gradient: "from-purple-500 to-pink-500"
              },
              {
                icon: Clock,
                title: "Save Time",
                description: "No more searching for help. Get instant answers right next to the form field",
                gradient: "from-rose-500 to-red-500"
              },
              {
                icon: TrendingUp,
                title: "Avoid Mistakes",
                description: "Warnings about common errors help you get your application right the first time",
                gradient: "from-indigo-500 to-blue-500"
              }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all hover:scale-105 hover:shadow-xl"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl mb-4 shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-4">
              <Play className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white/80">Simple Process</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-white/60 max-w-2xl mx-auto">Three simple steps to stress-free form filling</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Install Extension",
                description: "Add the extension to Chrome with one click. No account needed.",
                icon: Chrome
              },
              {
                step: "02",
                title: "Visit Government Portal",
                description: "Navigate to the form. The extension activates automatically.",
                icon: Globe
              },
              {
                step: "03",
                title: "Click Any Field",
                description: "Get instant AI guidance on what to enter and which option to select.",
                icon: MessageCircleQuestion
              }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                {idx < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-white/20 to-transparent" />
                )}
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-all">
                  <div className="text-5xl font-bold bg-gradient-to-br from-white/20 to-white/5 bg-clip-text text-transparent mb-4">
                    {item.step}
                  </div>
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 rounded-2xl mb-4">
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/60">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-emerald-500/20 to-blue-500/20 rounded-3xl blur-3xl" />
            
            {/* Card */}
            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl mb-6 shadow-2xl shadow-blue-500/30">
                <Chrome className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Fill Forms
                <span className="block bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Without Stress?</span>
              </h2>
              
              <p className="text-white/60 max-w-xl mx-auto mb-8">
                Join thousands of users who fill government forms with confidence. 
                Download the extension now - it's free!
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a 
                  href={`${BACKEND_URL}/api/extension/download`}
              data-testid="cta-download-btn"
                  className="group flex items-center gap-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                >
                  <Download className="w-6 h-6" />
                  <span>Download Free Extension</span>
                </a>
                <a 
                  href="https://services1.passportindia.gov.in/forms/PreLogin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <span>Visit Government Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/5 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <span className="font-semibold text-white/80">FormWise</span>
                <p className="text-xs text-white/40">AI-Powered Chrome Extension</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <Link to="/demo" className="text-sm text-white/50 hover:text-white transition-colors">Demo</Link>
              <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors">How it Works</a>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Lock className="w-4 h-4" />
              <span>Your privacy is protected</span>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-sm text-white/30">
              © 2024 FormWise. Made with AI to simplify bureaucracy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
