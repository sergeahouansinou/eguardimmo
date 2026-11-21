<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use App\Modules\Rent\Events\InstallmentOverdue;
use App\Modules\Rent\Events\PaymentCancelled;
use App\Modules\Rent\Events\PaymentRecorded;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    C::preparer($this);
    Mail::fake();
    $this->org = C::organisation();
    $this->equipe = N::equipe($this->org);
    ['lease' => $this->bail, 'user' => $this->locataire] = T::locataire($this->org);
});

function preferences(object $test, User $compte, array $lignes): TestResponse
{
    N::comme($test, $compte);

    return $test->putJson(N::URL.'/preferences', ['preferences' => $lignes]);
}

function canal(array $json, string $type, string $canal): array
{
    $ligne = collect($json['data']['types'])->firstWhere('type', $type);

    return collect($ligne['channels'])->firstWhere('channel', $canal);
}

it('ne propose que les types qui concernent le compte, avec les défauts du catalogue', function (): void {
    N::comme($this, $this->equipe['accountant']);
    $comptable = $this->getJson(N::URL.'/preferences')->assertOk()->json();

    expect(array_column($comptable['data']['types'], 'type'))->toBe(['rent.overdue', 'rent.payment_recorded', 'rent.payment_cancelled', 'recovery.bundle_sent', 'ownerfunds.payout_executed', 'ownerfunds.payout_returned', 'ownerfunds.payout_failed', 'ownerfunds.trust_gap', 'ownerfunds.account_change_requested', 'ownerfunds.account_change_contested', 'account.support_replied', 'planning.task_assigned', 'planning.task_due', 'planning.event_reminder', 'account.privacy_completed', 'account.export_ready', 'account.privacy_received'])
        ->and(canal($comptable, 'rent.overdue', 'push'))->toMatchArray(['enabled' => true, 'locked' => false])
        ->and(canal($comptable, 'rent.payment_recorded', 'email'))->toMatchArray(['enabled' => false, 'locked' => false])
        ->and(canal($comptable, 'rent.payment_recorded', 'push'))->toMatchArray(['enabled' => false])
        ->and(canal($comptable, 'rent.payment_cancelled', 'in_app'))->toMatchArray(['enabled' => true, 'locked' => true]);

    N::comme($this, $this->equipe['owner']);
    expect(array_column($this->getJson(N::URL.'/preferences')->json('data.types'), 'type'))->toHaveCount(40);

    N::comme($this, $this->locataire);
    expect(array_column($this->getJson(N::URL.'/preferences')->json('data.types'), 'type'))->toBe(['tenant.notice_issued', 'tenant.receipt_issued', 'tenant.payment_recorded', 'tenant.payment_cancelled', 'tenant.lease_signed', 'tenant.request_qualified', 'tenant.visit_scheduled', 'tenant.request_declined', 'tenant.work_completed', 'tenant.message_received', 'tenant.message_redacted', 'account.support_replied', 'tenant.announcement', 'tenant.charge_statement_issued', 'tenant.notice_acknowledged', 'tenant.notice_closed', 'tenant.insurance_accepted', 'tenant.insurance_rejected', 'tenant.insurance_expiring', 'tenant.insurance_expired', 'tenant.insurance_reminder', 'tenant.document_shared', 'tenant.inspection_published', 'tenant.inspection_remark_answered', 'tenant.online_payment_failed', 'account.privacy_completed', 'account.export_ready', 'account.privacy_received']);

    N::comme($this, User::factory()->create());
    $this->getJson(N::URL.'/preferences')->assertOk()->assertJsonCount(4, 'data.types');
});

it('enregistre une préférence par type et par canal, sans toucher aux autres comptes', function (): void {
    preferences($this, $this->equipe['owner'], [['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false]])->assertOk();

    expect(canal(preferences($this, $this->equipe['owner'], [['type' => 'rent.payment_recorded', 'channel' => 'push', 'enabled' => true]])->json(), 'rent.overdue', 'email')['enabled'])->toBeFalse();

    N::comme($this, $this->equipe['manager']);
    $json = $this->getJson(N::URL.'/preferences')->json();

    expect(canal($json, 'rent.overdue', 'email')['enabled'])->toBeTrue()
        ->and(canal($json, 'rent.payment_recorded', 'push')['enabled'])->toBeFalse()
        ->and(NotificationPreference::query()->where('user_id', $this->equipe['owner']->id)->count())->toBe(2);
});

it('refuse de désactiver un canal obligatoire, sans rien enregistrer du lot', function (): void {
    preferences($this, $this->equipe['owner'], [
        ['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false],
        ['type' => 'rent.payment_cancelled', 'channel' => 'in_app', 'enabled' => false],
    ])->assertUnprocessable()->assertJsonPath('code', 'notification_channel_mandatory');

    expect(NotificationPreference::query()->count())->toBe(0);

    preferences($this, $this->equipe['owner'], [['type' => 'rent.payment_cancelled', 'channel' => 'in_app', 'enabled' => true]])->assertOk();
    expect(NotificationPreference::query()->count())->toBe(0);
});

it('valide le corps en liste blanche', function (): void {
    preferences($this, $this->equipe['owner'], [])->assertUnprocessable();
    preferences($this, $this->equipe['owner'], [['type' => 'inconnu', 'channel' => 'email', 'enabled' => true]])->assertUnprocessable();
    preferences($this, $this->equipe['owner'], [['type' => 'rent.overdue', 'channel' => 'sms', 'enabled' => true]])->assertUnprocessable();
    preferences($this, $this->equipe['owner'], [['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => 'peut-être']])->assertUnprocessable();
    preferences($this, $this->equipe['owner'], [['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => true, 'user_id' => $this->equipe['manager']->id]])->assertUnprocessable();
});

it('un canal désactivé ne reçoit rien : ni e-mail, ni ligne si tous les canaux sont coupés', function (): void {
    $compte = $this->equipe['owner'];
    preferences($this, $compte, [
        ['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false],
        ['type' => 'rent.overdue', 'channel' => 'push', 'enabled' => false],
        ['type' => 'rent.payment_recorded', 'channel' => 'in_app', 'enabled' => false],
    ])->assertOk();

    event(new PaymentRecorded(Str::uuid7()->toString(), $this->bail->id, $this->org->id));
    $this->artisan('rent:generate')->assertSuccessful();
    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-05'));

    $surcharge = N::premiere($compte, Type::RentOverdue);
    expect($surcharge->in_app)->toBeTrue()->and($surcharge->email)->toBeFalse()->and($surcharge->push)->toBeFalse()
        ->and(N::nombre($compte, Type::RentPaymentRecorded))->toBe(0)
        ->and(N::nombre($this->equipe['manager'], Type::RentPaymentRecorded))->toBe(1);

    expect(Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($compte->email))->count())->toBe(0)
        ->and(Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($this->equipe['manager']->email))->count())->toBe(1);
});

it('une notification réservée à l\'e-mail n\'apparaît pas dans le centre', function (): void {
    $compte = $this->equipe['owner'];
    preferences($this, $compte, [['type' => 'rent.overdue', 'channel' => 'in_app', 'enabled' => false]])->assertOk();

    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-05'));

    N::comme($this, $compte);
    $this->getJson(N::URL)->assertOk()->assertJsonCount(0, 'data');
    expect(N::nombre($compte, Type::RentOverdue))->toBe(1);
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($compte->email));
});

it('un type obligatoire reste dans le centre quoi qu\'ait choisi le compte', function (): void {
    NotificationPreference::query()->create(['user_id' => $this->locataire->id, 'type' => Type::TenantPaymentCancelled->value, 'channel' => 'in_app', 'enabled' => false]);
    NotificationPreference::query()->create(['user_id' => $this->locataire->id, 'type' => Type::TenantPaymentCancelled->value, 'channel' => 'email', 'enabled' => false]);

    event(new PaymentCancelled(Str::uuid7()->toString(), $this->bail->id, $this->org->id));

    $n = N::premiere($this->locataire, Type::TenantPaymentCancelled);
    expect($n->in_app)->toBeTrue()->and($n->email)->toBeFalse();
});

it('l\'e-mail porte un lien https complet sur sa propre ligne, et rien sans base https valide', function (): void {
    $compte = $this->equipe['owner'];
    config(['notifications.urls.staff' => 'https://agence.example.test/']);

    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-05'));

    Mail::assertSent(NotificationMail::class, function (NotificationMail $m) use ($compte): bool {
        return $m->hasTo($compte->email)
            && $m->lien === 'https://agence.example.test/finances/impayes'
            && str_contains($m->render(), "\nhttps://agence.example.test/finances/impayes\n")
            && $m->subject === 'Loyer en retard';
    });

    Mail::fake();
    config(['notifications.urls.staff' => 'http://agence.example.test']);
    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-06'));

    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->lien === null && ! str_contains($m->render(), 'http'));
});

it('n\'envoie rien à une adresse non vérifiée', function (): void {
    $compte = $this->equipe['owner'];
    $compte->forceFill(['email_verified_at' => null])->save();

    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-05'));

    expect(N::nombre($compte, Type::RentOverdue))->toBe(1);
    Mail::assertNotSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($compte->email));
});

it('les notifications d\'une organisation ne parviennent qu\'à ses membres', function (): void {
    $autre = C::organisation(nom: 'Agence du Nord');
    $etranger = L::titulaire($autre);

    event(new RecoveryBundleSent($this->org->id, Str::uuid7()->toString(), 'jeton-de-test'));

    expect(N::nombre($this->equipe['owner'], Type::RecoveryBundleSent))->toBe(1)
        ->and(N::nombre($etranger))->toBe(0)
        ->and(Notification::query()->where('organization_id', $autre->id)->count())->toBe(0);
});
