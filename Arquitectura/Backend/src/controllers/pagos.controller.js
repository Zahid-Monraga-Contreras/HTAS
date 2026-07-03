const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const pagosController = {
    createCheckoutSession: async (req, res) => {
        const { uid, planType } = req.body;

        // Mapeo de tus IDs de Stripe (Pega aquí los IDs de tu Dashboard)
        const prices = {
            PRO: "price_1TF5GOK1qKH77YTdkm5FC6a5", // ID del Plan HTAS Full
            BASIC: "price_1TF5HrK1qKH77YTdQMhgG1VX", // ID del Plan Básico (si decides cobrar $0 por Stripe)
        };

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price: prices[planType],
                        quantity: 1,
                    },
                ],
                mode: "subscription",
                metadata: {
                    userId: uid,
                    plan: planType,
                },
                success_url: `http://localhost:4200/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `http://localhost:4200/landing`,
            });

            // CAMBIO AQUÍ: Enviamos la URL completa, no solo el ID
            res.json({ url: session.url });
        } catch (error) {
            console.error("Error Stripe:", error);
            res.status(500).json({ error: "Error al generar la transacción" });
        }
    },
};

module.exports = pagosController;