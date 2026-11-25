<?php

declare(strict_types=1);

use App\Modules\Notifications\Actions\DeliverNotificationEmail;
use App\Modules\Notifications\Enums\ReminderCode;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\ReminderRule;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\ReminderScenarios as S;

it('ne relance rien au titre d\'une organisation suspendue', function (ReminderCode $code): void {
    $cas = S::semer($this, $code, S::departs($code)['eligible']);
    $cas['organisation']->forceFill(['suspended_at' => now()])->save();
    S::activer($code);

    ($this->relancer)();

    expect(Notification::query()->count())->toBe(0);
    Mail::assertNothingSent();
})->with([
    'bien manquant' => [ReminderCode::PropertyMissing],
    'annonce manquante' => [ReminderCode::ListingMissing],
    'brouillon d\'annonce' => [ReminderCode::ListingDraft],
    'demande sans réponse' => [ReminderCode::LeadUnanswered],
    'invitation' => [ReminderCode::InvitationPending],
    'recouvrement' => [ReminderCode::RecoveryStalled],
    'échéance à venir' => [ReminderCode::RentDueSoon],
    'loyer impayé' => [ReminderCode::RentUnpaid],
    'fin d\'essai' => [ReminderCode::TrialEnding],
]);

it('n\'écrit pas à une adresse non confirmée dont le compte a été suspendu avant l\'envoi', function (): void {
    Queue::fake();
    $cas = S::semer($this, ReminderCode::EmailUnverified, S::departs(ReminderCode::EmailUnverified)['eligible']);
    S::activer(ReminderCode::EmailUnverified);
    ($this->relancer)();
    $notification = Notification::query()->firstOrFail();
    $cas['destinataire']->forceFill(['suspended_at' => now()])->save();

    app(DeliverNotificationEmail::class)->handle($notification->id);

    Mail::assertNothingSent();
    expect($notification->refresh()->emailed_at)->toBeNull();
});

dataset('rappels', array_combine(
    array_map(fn (ReminderCode $code): string => $code->value, ReminderCode::cases()),
    array_map(fn (ReminderCode $code): array => [$code], ReminderCode::cases()),
));

beforeEach(function (): void {
    Mail::fake();
    $this->travelTo(S::maintenant());
    L::semer();
    $this->relancer = fn () => $this->artisan('notifications:send-reminders')->assertSuccessful();
    $this->crees = fn (ReminderCode $code): array => Notification::query()->where('type', $code->type()->value)->pluck('user_id')->sort()->values()->all();
});

it('couvre les quatorze rappels du catalogue', function (): void {
    expect(ReminderCode::cases())->toHaveCount(14);
});

it('relance un cas éligible une seule fois, même rejoué', function (ReminderCode $code): void {
    $cas = S::semer($this, $code, S::departs($code)['eligible']);
    S::activer($code);

    ($this->relancer)();

    expect(($this->crees)($code))->toBe([$cas['destinataire']->id]);
    $notification = Notification::query()->where('type', $code->type()->value)->firstOrFail();
    expect($notification->dedup_key)->toStartWith($code->value.':')->toEndWith(':1')
        ->and($notification->email)->toBeTrue()
        ->and($notification->in_app)->toBe($code !== ReminderCode::EmailUnverified)
        ->and($notification->organization_id)->toBe($cas['organisation']?->id)
        ->and($notification->title)->not->toBe('')
        ->and(ReminderRule::query()->firstOrFail()->last_sent_count)->toBe(1);
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $courrier): bool => $courrier->hasTo($cas['destinataire']->email));

    ($this->relancer)();

    expect(($this->crees)($code))->toHaveCount(1)
        ->and(ReminderRule::query()->firstOrFail()->last_sent_count)->toBe(0)
        ->and(ReminderRule::query()->firstOrFail()->last_run_at)->not->toBeNull();
})->with('rappels');

it('ne relance pas un cas qui n\'est plus éligible', function (ReminderCode $code): void {
    $cas = S::semer($this, $code, S::departs($code)['eligible']);
    ($cas['annuler'])();
    S::activer($code);

    ($this->relancer)();

    expect(($this->crees)($code))->toBe([]);
})->with('rappels');

it('ne relance pas hors de sa fenêtre', function (ReminderCode $code, int $borne): void {
    S::semer($this, $code, S::departs($code)['hors'][$borne]);
    S::activer($code);

    ($this->relancer)();

    expect(($this->crees)($code))->toBe([]);
})->with('rappels')->with(['trop tôt' => 0, 'trop tard' => 1]);

it('n\'envoie rien tant que la règle est désactivée', function (ReminderCode $code): void {
    S::semer($this, $code, S::departs($code)['eligible']);

    ($this->relancer)();
    S::activer($code, ['enabled' => false]);
    ($this->relancer)();

    expect(($this->crees)($code))->toBe([])
        ->and(ReminderRule::query()->firstOrFail()->last_run_at)->toBeNull();
})->with('rappels');

it('limite les canaux à ceux de la règle', function (): void {
    S::semer($this, ReminderCode::SpaceNotCreated, S::departs(ReminderCode::SpaceNotCreated)['eligible']);
    S::activer(ReminderCode::SpaceNotCreated, ['channels' => ['in_app']]);

    ($this->relancer)();

    $notification = Notification::query()->firstOrFail();
    expect($notification->in_app)->toBeTrue()->and($notification->email)->toBeFalse()->and($notification->push)->toBeFalse();
    Mail::assertNothingSent();
});

it('relance à l\'intervalle réglé jusqu\'au nombre d\'occurrences, puis s\'arrête', function (): void {
    $code = ReminderCode::RentUnpaid;
    S::semer($this, $code, S::departs($code)['eligible']);
    S::activer($code);

    foreach ([0, 7, 7, 7, 7] as $jours) {
        $this->travel($jours)->days();
        ($this->relancer)();
    }

    expect(Notification::query()->where('type', $code->type()->value)->orderBy('created_at')->pluck('dedup_key')->map(fn (string $cle): string => substr($cle, -2))->all())
        ->toBe([':1', ':2', ':3']);
});

it('adresse les rappels d\'équipe aux rôles concernés', function (ReminderCode $code, array $roles): void {
    $cas = S::semer($this, $code, S::departs($code)['eligible']);
    $attendus = [$cas['destinataire']->id];

    foreach (MemberRole::cases() as $role) {
        if ($role === MemberRole::Owner) {
            continue;
        }

        $membre = L::membre($cas['organisation'], $role);

        if (in_array($role, $roles, true)) {
            $attendus[] = $membre->id;
        }
    }

    S::activer($code);
    ($this->relancer)();
    sort($attendus);

    expect(($this->crees)($code))->toBe($attendus);
})->with([
    'invitation' => [ReminderCode::InvitationPending, [MemberRole::Admin, MemberRole::Manager]],
    'recouvrement' => [ReminderCode::RecoveryStalled, [MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant]],
    'fin d\'essai' => [ReminderCode::TrialEnding, [MemberRole::Admin]],
]);

it('ignore une invitation expirée et un compte suspendu', function (): void {
    $invitation = S::semer($this, ReminderCode::InvitationPending, S::maintenant()->subDays(5));
    $this->travelTo(S::maintenant()->addDays(70));
    S::activer(ReminderCode::InvitationPending, ['delay_days' => 30, 'repeat_every_days' => 30, 'max_occurrences' => 3]);
    ($this->relancer)();
    $this->travelTo(S::maintenant());

    $suspendu = S::semer($this, ReminderCode::SpaceNotCreated, S::departs(ReminderCode::SpaceNotCreated)['eligible']);
    $suspendu['destinataire']->forceFill(['suspended_at' => now()])->save();
    S::activer(ReminderCode::SpaceNotCreated);
    ($this->relancer)();

    expect(Notification::query()->count())->toBe(0)->and($invitation['destinataire']->exists)->toBeTrue();
});

it('plafonne les notifications créées par passage', function (): void {
    $code = ReminderCode::SpaceNotCreated;
    foreach (range(1, 3) as $rang) {
        S::semer($this, $code, S::departs($code)['eligible']);
    }
    S::activer($code);
    config(['notifications.reminders.max_per_run' => 2]);

    ($this->relancer)();
    expect(($this->crees)($code))->toHaveCount(2);

    ($this->relancer)();
    expect(($this->crees)($code))->toHaveCount(3);
});
