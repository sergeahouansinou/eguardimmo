<?php

declare(strict_types=1);

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Actions\DeliverNotificationEmail;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;
use Tests\Feature\Tenant\TenantContext as T;

describe('alerte à l\'adresse principale de la fiche', function (): void {
    beforeEach(function (): void {
        ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
        Mail::fake();
        config(['notifications.urls.owner' => 'https://proprietaire.eguardimmo.test']);
        $this->acces = P::acces($this->awa);
        $this->vers = fn (string $adresse): int => Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => collect($m->to)->contains(fn (array $a): bool => mb_strtolower($a['address']) === mb_strtolower($adresse)))->count();
        $this->parcours = function (): void {
            $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
            P::confirmer($this, $this->awa, $id)->assertOk();
            P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk();
            O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();
        };
    });

    it('prévient aussi l\'adresse principale de la fiche à la demande, à la validation et à la contestation', function (): void {
        T::emailPrincipal($this->org, $this->mandant, 'principale@exemple.fr');

        ($this->parcours)();

        expect(($this->vers)('principale@exemple.fr'))->toBe(3)->and(($this->vers)($this->awa->email))->toBe(3);
        Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo('principale@exemple.fr') && $m->lien === 'https://proprietaire.eguardimmo.test/compte-de-paiement'
            && ! str_contains($m->titre.' '.$m->corps, 'FR76') && ! str_contains($m->titre.' '.$m->corps, $this->mandant->display_name));
    });

    it('n\'envoie qu\'un message quand l\'adresse principale est celle du compte', function (): void {
        T::emailPrincipal($this->org, $this->mandant, mb_strtoupper($this->awa->email));

        ($this->parcours)();

        expect(($this->vers)($this->awa->email))->toBe(3)->and(($this->vers)('principale@exemple.fr'))->toBe(0);
        Mail::assertNotSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo('principale@exemple.fr'));
    });

    it('ne fait rien de plus sans adresse principale', function (): void {
        ($this->parcours)();

        expect(($this->vers)($this->awa->email))->toBe(3)->and(($this->vers)(L::titulaire($this->org)->email))->toBe(2);
    });

    it('n\'alerte pas l\'adresse principale pour les autres types de notification', function (): void {
        T::emailPrincipal($this->org, $this->mandant, 'principale@exemple.fr');

        $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
        P::confirmer($this, $this->awa, $id)->assertOk();

        expect(N::nombre(L::titulaire($this->org), NotificationType::OwnerFundsAccountChangeRequested))->toBe(1)->and(($this->vers)('principale@exemple.fr'))->toBe(1);
    });
});

describe('type sans alerte de sécurité', function (): void {
    it('ne prévient pas l\'adresse principale pour une notification ordinaire du mandant', function (): void {
        ['org' => $org, 'mandant' => $mandant, 'awa' => $awa] = P::scene($this);
        Mail::fake();
        T::emailPrincipal($org, $mandant, 'principale@exemple.fr');

        app(CreateNotifications::class)->handle(new NotificationInput(NotificationType::OwnerPayoutExecuted, $org->id, 'payout:test:executed', [], null, null, $mandant->id));

        Mail::assertSent(NotificationMail::class, 1);
        Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($awa->email));
        Mail::assertNotSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo('principale@exemple.fr'));
    });
});

describe('e-mail d\'une notification propriétaire dont la fenêtre est close', function (): void {
    beforeEach(function (): void {
        L::semer();
        $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
        Mail::fake();
        $this->org = T::organisation();
        $this->p = O::proprietaire($this->org);
        $this->ligne = fn (): Notification => N::ligne($this->p['user'], $this->org, NotificationType::OwnerPayoutExecuted, ['party_id' => $this->p['party']->id, 'email' => true]);
        $this->terminer = fn (int $mois) => L::dans($this->org, fn () => $this->p['mandate']->forceFill(['status' => 'terminated', 'ends_on' => now()->subMonths($mois)->toDateString()])->save());
    });

    it('envoie tant que la fenêtre est ouverte, grâce comprise', function (): void {
        $actif = ($this->ligne)();
        app(DeliverNotificationEmail::class)->handle($actif->id);

        ($this->terminer)(2);
        $grace = ($this->ligne)();
        app(DeliverNotificationEmail::class)->handle($grace->id);

        Mail::assertSent(NotificationMail::class, 2);
        expect($actif->refresh()->emailed_at)->not->toBeNull()->and($grace->refresh()->emailed_at)->not->toBeNull();
    });

    it('n\'envoie rien une fois la fenêtre échue, ni après la révocation de l\'accès', function (): void {
        ($this->terminer)(13);
        $echue = ($this->ligne)();
        app(DeliverNotificationEmail::class)->handle($echue->id);

        L::dans($this->org, fn () => $this->p['mandate']->forceFill(['status' => 'active', 'ends_on' => '2030-01-01'])->save());
        L::dans($this->org, fn () => $this->p['access']->forceFill(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization'])->save());
        $revoque = ($this->ligne)();
        app(DeliverNotificationEmail::class)->handle($revoque->id);

        Mail::assertNothingSent();
        expect($echue->refresh()->emailed_at)->toBeNull()->and($revoque->refresh()->emailed_at)->toBeNull();
    });

    it('ne touche pas aux notifications de l\'équipe', function (): void {
        $agent = L::titulaire($this->org);
        $ligne = N::ligne($agent, $this->org, NotificationType::OwnerFundsAccountChangeRequested, ['email' => true]);

        app(DeliverNotificationEmail::class)->handle($ligne->id);

        Mail::assertSent(NotificationMail::class, 1);
    });
});
