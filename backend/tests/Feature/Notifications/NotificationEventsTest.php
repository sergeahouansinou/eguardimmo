<?php

declare(strict_types=1);

use App\Modules\Documents\Models\Certificate;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Rent\Events\InstallmentOverdue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Documents\DocumentsContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Recovery\RecoveryContext as R;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as TR;

beforeEach(function (): void {
    C::preparer($this);
});

it('loyer en retard : l\'équipe qui lit les loyers est notifiée, pas le locataire', function (): void {
    $org = C::organisation();
    $equipe = N::equipe($org);
    ['user' => $locataire, 'lease' => $bail] = T::locataire($org);
    C::emises($org, $bail, $this);

    $this->artisan('rent:generate')->assertSuccessful();

    foreach ($equipe as $compte) {
        $n = N::premiere($compte, Type::RentOverdue);

        expect($n->title)->toBe('Loyer en retard')
            ->and($n->body)->toContain($bail->reference)->toContain('05/11/2026')
            ->and($n->link)->toBe('/finances/impayes')
            ->and($n->organization_id)->toBe($org->id)
            ->and($n->in_app)->toBeTrue()
            ->and($n->read_at)->toBeNull();
    }

    expect(N::nombre($locataire, Type::RentOverdue))->toBe(0);
});

it('avis d\'échéance, paiement, quittance et annulation : le locataire et l\'équipe reçoivent chacun le texte de leur audience', function (): void {
    $org = C::organisation();
    $equipe = N::equipe($org);
    $s = TR::facture($this, $org);

    expect(N::types($s['user']))->toBe([Type::TenantNoticeIssued->value])
        ->and(N::nombre($equipe['owner']))->toBe(0);

    $paiement = TR::encaisser($this, $org, $s['lease'], 70000)->json('data.id');

    expect(N::types($s['user']))->toBe([Type::TenantNoticeIssued->value, Type::TenantPaymentRecorded->value, Type::TenantReceiptIssued->value]);
    foreach ($equipe as $compte) {
        expect(N::types($compte))->toBe([Type::RentPaymentRecorded->value]);
    }

    $this->postJson(C::url($org, "/payments/{$paiement}/cancel"), ['reason' => 'Chèque rejeté'])->assertOk();

    expect(N::nombre($s['user'], Type::TenantPaymentCancelled))->toBe(1)
        ->and(N::nombre($equipe['accountant'], Type::RentPaymentCancelled))->toBe(1)
        ->and(N::premiere($s['user'], Type::TenantReceiptIssued)->link)->toBe('/loyers')
        ->and(N::premiere($s['user'], Type::TenantPaymentCancelled)->body)->toContain($s['lease']->reference);
});

it('bail signé : propriétaire et gestionnaire, jamais le comptable ; le locataire reçoit son propre texte', function (): void {
    $org = C::organisation();
    $this->org = $org;
    $equipe = N::equipe($org);
    ['bail' => $bail, 'locataire' => $partie] = S::brouillon($org);
    $locataire = User::factory()->create();
    TR::rattacher($org, $partie, $locataire);

    S::appliquer($this, $bail);

    expect(N::nombre($equipe['owner'], Type::LeaseSigned))->toBe(1)
        ->and(N::nombre($equipe['manager'], Type::LeaseSigned))->toBe(1)
        ->and(N::nombre($equipe['accountant']))->toBe(0)
        ->and(N::premiere($locataire, Type::TenantLeaseSigned)->link)->toBe('/bail')
        ->and(N::premiere($equipe['owner'], Type::LeaseSigned)->link)->toBe("/baux/{$bail->id}");
});

it('dossier de recouvrement transmis : l\'équipe est avisée, le jeton ne figure nulle part', function (): void {
    R::preparer($this);
    $org = C::organisation();
    $equipe = N::equipe($org);
    $s = R::impayes($this, $org);
    $dossier = R::ouvrir($this, $org, $s['bail'], $s['locataire'], array_slice($s['ids'], 0, 3))->assertCreated()->json('data.id');
    $envoi = R::envoi($this, ['org' => $org, 'case' => $dossier]);
    $commissaire = R::bailiff($this, $org);
    $this->postJson(R::url($org, "/bundles/{$envoi}/transmissions"), ['recipient_party_id' => $commissaire])->assertCreated();
    $jeton = R::jeton();

    foreach ($equipe as $compte) {
        expect(N::nombre($compte, Type::RecoveryBundleSent))->toBe(1);
    }

    expect(json_encode(DB::table('notifications')->get()))->not->toContain($jeton);
});

it('pièce à renouveler puis expirée : propriétaire et gestionnaire seulement, une fois par état', function (): void {
    D::semer();
    $org = D::organisation();
    $equipe = N::equipe($org);
    $type = D::type('energy_performance');
    $piece = L::dans($org, fn (): Certificate => Certificate::query()->create([
        'subject_type' => 'organization',
        'subject_id' => $org->id,
        'certificate_type_term_id' => $type,
        'issued_on' => '2016-02-09',
        'expires_on' => '2027-02-09',
        'data' => [],
    ]));

    $this->artisan('documents:flag-certificates')->expectsOutputToContain('1 pièce(s) signalée(s)')->assertSuccessful();
    $this->artisan('documents:flag-certificates')->assertSuccessful();

    $n = N::premiere($equipe['owner'], Type::CertificateToRenew);
    expect($n->body)->toContain('Diagnostic de performance énergétique')->toContain('09/02/2027')
        ->and($n->link)->toBe("/conformite/{$piece->id}")
        ->and(N::nombre($equipe['owner'], Type::CertificateToRenew))->toBe(1)
        ->and(N::nombre($equipe['manager'], Type::CertificateToRenew))->toBe(1)
        ->and(N::nombre($equipe['accountant']))->toBe(0);

    $this->travelTo('2027-02-11 10:00:00');
    $this->artisan('documents:flag-certificates')->assertSuccessful();

    expect(N::nombre($equipe['owner'], Type::CertificateExpired))->toBe(1)
        ->and(N::nombre($equipe['owner'], Type::CertificateToRenew))->toBe(1);
});

it('une pièce expirée depuis longtemps ou sans échéance ne produit rien', function (): void {
    D::semer();
    $org = D::organisation();
    $type = D::type('energy_performance');
    L::dans($org, function () use ($org, $type): void {
        foreach (['2026-10-01', null, '2036-01-01'] as $echeance) {
            Certificate::query()->create(['subject_type' => 'organization', 'subject_id' => $org->id, 'certificate_type_term_id' => $type, 'issued_on' => '2016-02-09', 'expires_on' => $echeance, 'data' => []]);
        }
    });

    $this->artisan('documents:flag-certificates')->expectsOutputToContain('0 pièce(s) signalée(s)')->assertSuccessful();

    expect(Notification::query()->count())->toBe(0);
});

it('un rejeu de l\'événement ne crée ni ne renvoie rien', function (): void {
    Mail::fake();
    $org = C::organisation();
    $equipe = N::equipe($org);
    ['lease' => $bail] = T::locataire($org);
    C::emises($org, $bail, $this);
    $this->artisan('rent:generate')->assertSuccessful();
    $evenement = new InstallmentOverdue(C::echeances($org, $bail)[0]->id, $bail->id, $org->id, '2026-11-05');

    event($evenement);
    event($evenement);

    expect(N::nombre($equipe['owner'], Type::RentOverdue))->toBe(1)
        ->and(Notification::query()->where('type', Type::RentOverdue->value)->count())->toBe(3);
    expect(Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => $m->titre === 'Loyer en retard')->count())->toBe(3);
});
