<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\PlatformContext as P;

beforeEach(function (): void {
    $this->operateur = P::preparer($this);
    $this->jeton = $this->operateur['jeton'];
});

it('pousse le titre et le corps rédigés et ouvre une notification du centre selon la préférence', function (): void {
    $awa = P::compte('awa@exemple.fr');
    $marc = P::compte('marc@exemple.fr');
    $sans = P::compte('sans@exemple.fr');
    P::appareil($awa);
    P::appareil($marc);
    P::preference($marc, NotificationType::AccountServiceMessage, NotificationChannel::InApp, false);
    $id = P::creer($this, $this->jeton, P::push());

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)
        ->assertJsonPath('data.sent_count', 2)->assertJsonPath('data.recipient_count', 4)->assertJsonPath('data.stats.skipped_no_device', 2);

    $notification = Notification::query()->where('user_id', $awa->id)->firstOrFail();
    expect(P::pilote()->sent)->toHaveCount(2)
        ->and($notification->title)->toBe('Maintenance prévue')
        ->and($notification->body)->toBe('Le service sera indisponible dimanche matin.')
        ->and($notification->link)->toBe('/notifications')
        ->and($notification->audience->value)->toBe('account')
        ->and($notification->in_app)->toBeTrue()
        ->and($notification->pushed_at)->not->toBeNull()
        ->and(Notification::query()->where('user_id', $marc->id)->firstOrFail()->in_app)->toBeFalse()
        ->and(Notification::query()->where('user_id', $sans->id)->exists())->toBeFalse()
        ->and(PlatformCampaignDelivery::query()->whereNotNull('email_hash')->exists())->toBeFalse();

    $message = collect(P::pilote()->sent)->map(fn (array $envoi): mixed => $envoi['message'])->first();
    expect($message->title)->toBe('Maintenance prévue')->and($message->link)->toBe('/notifications');
});

it('exige un accord pour un push marketing', function (): void {
    $awa = P::compte('awa@exemple.fr');
    $marc = P::compte('marc@exemple.fr');
    P::appareil($awa);
    P::appareil($marc);
    P::preference($awa, NotificationType::AccountMarketing, NotificationChannel::Push);
    $id = P::creer($this, $this->jeton, P::push(['category' => 'marketing']));

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.sent_count', 1)->assertJsonPath('data.stats.suppressed', 2);
    expect(P::pilote()->sent)->toHaveCount(1);
});

it('révoque un appareil refusé et compte l\'échec', function (): void {
    $appareil = P::appareil(P::compte('awa@exemple.fr'));
    P::pilote()->invalidTokens = [$appareil->token];
    $id = P::creer($this, $this->jeton, P::push());

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.failed_count', 1);
    expect($appareil->refresh()->revoked_at)->not->toBeNull();
});

it('refuse l\'envoi sans appareil ou sans service de push', function (): void {
    $id = P::creer($this, $this->jeton, P::push());

    P::envoyer($this, $this->jeton, $id)->assertConflict()->assertJsonPath('code', 'platform_campaign_no_device');
    config(['notifications.push.driver' => 'none']);
    P::envoyer($this, $this->jeton, $id)->assertStatus(503)->assertJsonPath('code', 'push_sending_disabled');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test")->assertStatus(503)->assertJsonPath('code', 'push_sending_disabled');
    expect(PlatformCampaignDelivery::query()->count())->toBe(0);
});

it('envoie un essai push aux appareils de l\'opérateur seulement', function (): void {
    P::appareil(P::compte('awa@exemple.fr'));
    $id = P::creer($this, $this->jeton, P::push());

    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test")->assertConflict()->assertJsonPath('code', 'platform_campaign_no_device');

    P::appareil($this->operateur['user']);
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test")->assertOk()->assertJsonPath('data.sent_to', 'ops@eguardimmo.test');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test")->assertOk();

    expect(P::pilote()->sent)->toHaveCount(2)
        ->and(Notification::query()->count())->toBe(2)
        ->and(Notification::query()->where('user_id', '!=', $this->operateur['user']->id)->exists())->toBeFalse();
});
