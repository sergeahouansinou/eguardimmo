<?php

declare(strict_types=1);

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationPlatformSetting;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Notifications\Models\ReminderRule;
use App\Modules\Notifications\Queries\EffectivePreferences;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\PlatformContext as P;

beforeEach(function (): void {
    Mail::fake();
    $this->operateur = P::preparer($this);
    $this->jeton = $this->operateur['jeton'];
    $this->types = fn (): mixed => ConsoleContext::lire($this, $this->jeton, P::CONSOLE.'/notifications/types')->assertOk();
    $this->couper = fn (array $changements): mixed => ConsoleContext::ecrire($this, $this->jeton, 'PUT', P::CONSOLE.'/notifications/types', ['changes' => $changements]);
});

it('liste les types réglables sans les rappels ni les campagnes', function (): void {
    $types = collect(($this->types)()->json('data'))->keyBy('type');

    expect($types)->toHaveKey('rent.overdue')->not->toHaveKey('account.marketing')->not->toHaveKey('account.service_message')
        ->not->toHaveKey('tenant.reminder_rent_unpaid')->not->toHaveKey('reminders.trial_ending')
        ->and($types['rent.overdue']['audience_label'])->toBe('Équipe')
        ->and($types['rent.overdue']['channels'])->toHaveCount(3);
});

it('coupe un canal pour tous les comptes puis le rétablit', function (): void {
    $compte = P::compte('awa@exemple.fr');
    P::preference($compte, NotificationType::AccountReminderSpace, NotificationChannel::Email);
    $canaux = fn (): array => app(EffectivePreferences::class)->channelsFor([$compte->id], NotificationType::RentOverdue)[$compte->id];
    $avant = $canaux();

    $reponse = ($this->couper)([['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false]])->assertOk();
    $ligne = collect($reponse->json('data'))->firstWhere('type', 'rent.overdue');

    expect(collect($ligne['channels'])->firstWhere('channel', 'email')['enabled'])->toBeFalse()
        ->and($avant)->toContain(NotificationChannel::Email)
        ->and($canaux())->not->toContain(NotificationChannel::Email)->toContain(NotificationChannel::InApp)
        ->and(NotificationPlatformSetting::query()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'console.notifications.types_updated')->count())->toBe(1);

    ($this->couper)([['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => true]])->assertOk();

    expect($canaux())->toBe($avant)->and(NotificationPlatformSetting::query()->count())->toBe(0);
});

it('n\'écrit plus par un canal coupé', function (): void {
    $compte = P::compte('awa@exemple.fr');
    $type = NotificationType::AccountReminderSpace;
    NotificationPlatformSetting::query()->create(['type' => $type, 'channel' => NotificationChannel::Email]);

    app(CreateNotifications::class)->handle(new NotificationInput($type, null, 'essai-1', recipientId: $compte->id));

    expect(Notification::query()->firstOrFail()->email)->toBeFalse()->and(Notification::query()->firstOrFail()->in_app)->toBeTrue();
    Mail::assertNothingSent();
});

it('refuse de couper un canal verrouillé, sans rien enregistrer', function (): void {
    $verrouille = collect(NotificationType::configurable())->first(fn (NotificationType $type): bool => $type->locked() !== []);

    ($this->couper)([
        ['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false],
        ['type' => $verrouille->value, 'channel' => $verrouille->locked()[0]->value, 'enabled' => false],
    ])->assertUnprocessable()->assertJsonPath('code', 'notification_channel_mandatory');

    expect(NotificationPlatformSetting::query()->count())->toBe(0);
});

it('ignore une coupure enregistrée sur un canal verrouillé', function (): void {
    $compte = P::compte('awa@exemple.fr');
    $verrouille = collect(NotificationType::configurable())->first(fn (NotificationType $type): bool => $type->locked() !== []);
    NotificationPlatformSetting::query()->create(['type' => $verrouille, 'channel' => $verrouille->locked()[0]]);

    expect(app(EffectivePreferences::class)->channelsFor([$compte->id], $verrouille)[$compte->id])->toContain($verrouille->locked()[0]);
});

it('valide les changements de types', function (array $changement): void {
    ($this->couper)([$changement])->assertUnprocessable();
})->with([
    'type inconnu' => [['type' => 'inconnu', 'channel' => 'email', 'enabled' => false]],
    'type de campagne' => [['type' => 'account.marketing', 'channel' => 'email', 'enabled' => false]],
    'type de rappel' => [['type' => 'tenant.reminder_rent_due', 'channel' => 'email', 'enabled' => false]],
    'canal inconnu' => [['type' => 'rent.overdue', 'channel' => 'sms', 'enabled' => false]],
    'champ en trop' => [['type' => 'rent.overdue', 'channel' => 'email', 'enabled' => false, 'locked' => false]],
]);

it('journalise chaque changement d\'accord marketing du compte', function (): void {
    $compte = P::compte('awa@exemple.fr');
    $regler = function (bool $actif, string $canal = 'email', string $type = 'account.marketing') use ($compte): mixed {
        auth()->forgetGuards();

        return $this->actingAs($compte)->putJson('/api/v1/notifications/preferences', ['preferences' => [['type' => $type, 'channel' => $canal, 'enabled' => $actif]]]);
    };
    $journal = fn (): int => AuditLog::query()->where('action', 'notifications.marketing_consent.changed')->count();

    $regler(false)->assertSuccessful();
    expect($journal())->toBe(0);

    $regler(true)->assertSuccessful();
    $regler(true)->assertSuccessful();
    expect($journal())->toBe(1);

    $regler(false)->assertSuccessful();
    $regler(true, type: 'account.service_message')->assertSuccessful();

    expect($journal())->toBe(2)
        ->and(NotificationPreference::query()->where('type', 'account.marketing')->firstOrFail()->enabled)->toBeFalse()
        ->and(AuditLog::query()->where('action', 'notifications.marketing_consent.changed')->latest('created_at')->firstOrFail()->actor_user_id)->toBe($compte->id);
});

it('liste les quatorze rappels, désactivés avec les valeurs du catalogue', function (): void {
    ConsoleContext::lire($this, $this->jeton, P::CONSOLE.'/notifications/reminders')->assertOk()
        ->assertJsonCount(14, 'data')
        ->assertJsonPath('data.0.code', 'account_inactive')
        ->assertJsonPath('data.0.enabled', false)
        ->assertJsonPath('data.0.delay_days', 14)
        ->assertJsonPath('data.0.delay_min', 7)
        ->assertJsonPath('data.0.delay_max', 365)
        ->assertJsonPath('data.1.available_channels', ['email'])
        ->assertJsonPath('data.0.last_run_at', null)
        ->assertJsonPath('data.0.updated_at', null);
});

it('enregistre le réglage d\'un rappel et le journalise', function (): void {
    $reglage = ['enabled' => true, 'delay_days' => 10, 'repeat_every_days' => 4, 'max_occurrences' => 4, 'channels' => ['push', 'email']];

    ConsoleContext::ecrire($this, $this->jeton, 'PUT', P::CONSOLE.'/notifications/reminders/rent_unpaid', $reglage)->assertOk()
        ->assertJsonPath('data.enabled', true)->assertJsonPath('data.delay_days', 10)->assertJsonPath('data.channels', ['email', 'push'])
        ->assertJsonPath('data.timing', 'after');
    ConsoleContext::ecrire($this, $this->jeton, 'PUT', P::CONSOLE.'/notifications/reminders/rent_unpaid', [...$reglage, 'repeat_every_days' => null])->assertOk()
        ->assertJsonPath('data.repeat_every_days', null)->assertJsonPath('data.max_occurrences', 1);

    expect(ReminderRule::query()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'console.notifications.reminder_updated')->count())->toBe(2);
});

it('borne le réglage d\'un rappel', function (string $code, array $surcharges, string $champ): void {
    ConsoleContext::ecrire($this, $this->jeton, 'PUT', P::CONSOLE.'/notifications/reminders/'.$code, [
        'enabled' => true, 'delay_days' => 3, 'repeat_every_days' => null, 'max_occurrences' => 1, 'channels' => ['email'], ...$surcharges,
    ])->assertUnprocessable()->assertJsonValidationErrors($champ);

    expect(ReminderRule::query()->count())->toBe(0);
})->with([
    'délai trop court' => ['account_inactive', ['delay_days' => 6], 'delay_days'],
    'délai trop long' => ['rent_due_soon', ['delay_days' => 16], 'delay_days'],
    'intervalle nul' => ['rent_unpaid', ['repeat_every_days' => 0], 'repeat_every_days'],
    'trop d\'occurrences' => ['rent_unpaid', ['max_occurrences' => 6], 'max_occurrences'],
    'trop d\'occurrences vers une adresse non confirmée' => ['email_unverified', ['repeat_every_days' => 5, 'max_occurrences' => 3], 'max_occurrences'],
    'aucun canal' => ['rent_unpaid', ['channels' => []], 'channels'],
    'canal indisponible' => ['email_unverified', ['channels' => ['push']], 'channels.0'],
]);
