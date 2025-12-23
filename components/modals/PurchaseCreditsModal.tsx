import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { XIcon, CreditCardIcon } from '../icons';
import { useCredits } from '../../hooks/useCredits';
import { auth } from '../../firebaseConfig';

interface PurchaseCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PACKAGES = [
    { credits: 50, price: 5.00, label: "Paquete Básico" },
    { credits: 200, price: 15.00, label: "Paquete Pro" }
];

export const PurchaseCreditsModal: React.FC<PurchaseCreditsModalProps> = ({ isOpen, onClose }) => {
    const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0]);
    const { addCredits } = useCredits(auth.currentUser);

    if (!isOpen) return null;

    const handleApprove = async (data: any, actions: any) => {
        if (!actions.order) return;
        return actions.order.capture().then(async (details: any) => {
            console.log("Transaction completed by " + details.payer.name.given_name);
            const success = await addCredits(selectedPackage.credits);
            if (success) {
                alert(`¡Compra exitosa! Se han añadido ${selectedPackage.credits} créditos a tu cuenta.`);
                onClose();
            } else {
                alert("Hubo un error al actualizar tus créditos. Por favor contáctanos.");
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-theme-bg-secondary w-full max-w-md rounded-2xl shadow-2xl border border-theme-bg-tertiary overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-theme-bg-tertiary flex justify-between items-center bg-theme-bg-primary/50">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-theme-text-primary">
                        <CreditCardIcon className="w-6 h-6 text-theme-accent-primary" />
                        Comprar Créditos
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-theme-bg-hover rounded-full transition-colors text-theme-text-secondary hover:text-theme-text-primary">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <p className="text-theme-text-secondary mb-6 text-sm">
                        Adquiere créditos para generar renders arquitectónicos de alta calidad y mejorar tus bocetos con IA.
                    </p>

                    {/* Package Selection */}
                    <div className="space-y-3 mb-8">
                        {PACKAGES.map((pkg) => (
                            <button
                                key={pkg.credits}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all group ${selectedPackage.credits === pkg.credits
                                    ? 'border-theme-accent-primary bg-theme-accent-primary/10'
                                    : 'border-theme-bg-tertiary hover:border-theme-accent-primary/50 hover:bg-theme-bg-tertiary'
                                    }`}
                            >
                                <div className="text-left">
                                    <span className={`block font-bold ${selectedPackage.credits === pkg.credits ? 'text-theme-accent-primary' : 'text-theme-text-primary'}`}>
                                        {pkg.credits} Créditos
                                    </span>
                                    <span className="text-xs text-theme-text-secondary font-medium">{pkg.label}</span>
                                </div>
                                <div className="text-xl font-bold text-theme-text-primary">
                                    ${pkg.price}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* PayPal Buttons */}
                    <div className="relative z-0">
                        <PayPalScriptProvider options={{
                            clientId: (import.meta.env as any).VITE_PAYPAL_CLIENT_ID || "sb", // Fallback to sandbox if not set
                            currency: "USD"
                        }}>
                            <PayPalButtons
                                key={selectedPackage.credits} // Force re-render on package change
                                style={{ layout: "vertical", shape: "rect", borderRadius: 8 }}
                                createOrder={(data, actions) => {
                                    return actions.order.create({
                                        purchase_units: [
                                            {
                                                description: `Sketcher - ${selectedPackage.credits} Credits`,
                                                amount: {
                                                    value: selectedPackage.price.toString(),
                                                },
                                            },
                                        ],
                                    });
                                }}
                                onApprove={handleApprove}
                            />
                        </PayPalScriptProvider>
                        {!(import.meta.env as any).VITE_PAYPAL_CLIENT_ID && (
                            <p className="text-xs text-amber-500 mt-2 text-center bg-amber-500/10 p-2 rounded">
                                * Modo Sandbox (Configurar VITE_PAYPAL_CLIENT_ID)
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
