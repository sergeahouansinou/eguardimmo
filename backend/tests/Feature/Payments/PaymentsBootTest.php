<?php

declare(strict_types=1);

use App\Modules\Payments\PaymentsServiceProvider;
use App\Modules\Payments\Support\PaymentsBoot;

const RETOUR_HTTPS = 'https://locataire.eguardimmo.com/paiement/retour';

it('ne démarre pas en production avec la passerelle simulée, un secret simulé ou une page de retour hors HTTPS', function (): void {
    PaymentsBoot::assertBootable('none', true, '', RETOUR_HTTPS);
    PaymentsBoot::assertBootable('none', true, null, RETOUR_HTTPS);
    PaymentsBoot::assertBootable('stripe', true, '', RETOUR_HTTPS);

    expect(fn () => PaymentsBoot::assertBootable('fake', true, '', RETOUR_HTTPS))->toThrow(RuntimeException::class, 'fake')
        ->and(fn () => PaymentsBoot::assertBootable('none', true, 'whsec_fake', RETOUR_HTTPS))->toThrow(RuntimeException::class, 'PAYMENTS_FAKE_WEBHOOK_SECRET')
        ->and(fn () => PaymentsBoot::assertBootable('none', true, '', 'http://locataire.eguardimmo.com/retour'))->toThrow(RuntimeException::class, 'https://')
        ->and(fn () => PaymentsBoot::assertBootable('none', true, '', null))->toThrow(RuntimeException::class, 'https://');
});

it('accepte la passerelle simulée et une page de retour HTTP hors production, et refuse une valeur inconnue partout', function (): void {
    PaymentsBoot::assertBootable('fake', false, 'whsec_test', 'http://locataire.eguardimmo.test:3002/paiement/retour');

    expect(fn () => PaymentsBoot::assertBootable('stripee', false, '', RETOUR_HTTPS))->toThrow(InvalidArgumentException::class)
        ->and(fn () => PaymentsBoot::assertBootable(null, true, '', RETOUR_HTTPS))->toThrow(InvalidArgumentException::class);
});

it('fait échouer le démarrage du module en production avec la passerelle simulée', function (): void {
    $fournisseur = app()->getProvider(PaymentsServiceProvider::class);
    $env = app()['env'];

    try {
        app()['env'] = 'production';
        config(['payments.gateway' => 'fake', 'payments.return_url' => RETOUR_HTTPS]);

        expect(fn () => $fournisseur->boot())->toThrow(RuntimeException::class, 'fake');

        config(['payments.gateway' => 'none']);
        $fournisseur->boot();

        config(['payments.return_url' => 'http://locataire.eguardimmo.com/retour']);

        expect(fn () => $fournisseur->boot())->toThrow(RuntimeException::class, 'https://');
    } finally {
        app()['env'] = $env;
    }
});

it('désactive le paiement en ligne par défaut', function (): void {
    expect((string) file_get_contents(config_path('payments.php')))->toContain("env('PAYMENTS_GATEWAY', 'none')");
});
