import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getCurrentUserId, processPayment } from '../utils/api';

export default function PaymentScreen({ navigate, userId, userEmail }) {
  const plans = useMemo(
    () => [
      {
        id: 'starter',
        name: 'Starter',
        price: 9,
        period: 'month',
        description: 'For light, personal use',
        features: ['15 scans per day', 'History access', 'Standard support'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 19,
        period: 'month',
        description: 'For frequent diagnostics',
        features: ['Unlimited scans', 'Priority support', 'Detailed reports'],
        highlight: 'Most popular',
      },
      {
        id: 'team',
        name: 'Team',
        price: 39,
        period: 'month',
        description: 'For teams and growers',
        features: ['Team workspace', 'Shared reports', 'Dedicated support'],
      },
    ],
    []
  );

  const [selectedPlan, setSelectedPlan] = useState(plans[1].id);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedPlanDetails = plans.find((plan) => plan.id === selectedPlan);
  const totalPrice = selectedPlanDetails ? selectedPlanDetails.price : 0;
  const receiptEmail = userEmail || 'your account email';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const resolvedUserId = userId || getCurrentUserId();
    if (!resolvedUserId) {
      setError('Please sign in to continue.');
      return;
    }

    if (!cardName || !cardNumber || !expiry || !cvc) {
      setError('Please complete the card details.');
      return;
    }

    setLoading(true);
    try {
      await processPayment(resolvedUserId, selectedPlan, 'card');
      setSuccess('Payment successful. Your plan is now active.');
    } catch (err) {
      setError(err?.error || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('profile')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-green-600" />
          <h2 className="text-gray-900">Subscription</h2>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-md space-y-2">
          <h3 className="text-gray-900">Choose a plan</h3>
          <p className="text-sm text-gray-600">Upgrade for more scans and advanced analytics.</p>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`rounded-2xl border p-4 text-left transition shadow-sm ${
                    isSelected
                      ? 'border-green-600 ring-2 ring-green-200 bg-green-50/60'
                      : 'border-gray-200 bg-white hover:border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-gray-900">{plan.name}</p>
                      <p className="text-xs text-gray-500">{plan.description}</p>
                    </div>
                    {plan.highlight && (
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                        {plan.highlight}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl text-gray-900">${plan.price}</p>
                    <p className="text-xs text-gray-500">per {plan.period}</p>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
              {success}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <h3 className="text-gray-900">Payment details</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="cardName">Name on card</Label>
                <Input
                  id="cardName"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="cc-name"
                  disabled={loading}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cardNumber">Card number</Label>
                <Input
                  id="cardNumber"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="expiry">Expiry</Label>
                <Input
                  id="expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Receipt will be sent to {receiptEmail}.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-gray-900">Order summary</h3>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{selectedPlanDetails?.name || 'Plan'}</span>
              <span>${totalPrice} / {selectedPlanDetails?.period || 'month'}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-gray-900">
              <span>Total due today</span>
              <span className="text-lg">${totalPrice}</span>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm and Pay'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
