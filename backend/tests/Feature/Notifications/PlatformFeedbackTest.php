<?php

declare(strict_types=1);

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\MailSuppression;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Notifications\PlatformContext as P;

beforeEach(function (): void {
    Mail::fake();
    $this->operateur = P::preparer($this);
    $this->jeton = $this->operateur['jeton'];
    $this->awa = P::abonne('awa@exemple.fr');
    $this->campagne = P::creer($this, $this->jeton, P::email(['audience' => 'selected', 'recipient_emails' => ['awa@exemple.fr']]));
    P::envoyer($this, $this->jeton, $this->campagne)->assertStatus(202);
    $this->envoi = PlatformCampaignDelivery::query()->firstOrFail();
    $this->lien = '/api/v1/mail/unsubscribe/'.app(UnsubscribeToken::class)->issue($this->envoi);
    $this->accord = fn (): ?bool => NotificationPreference::query()->where('user_id', $this->awa->id)
        ->where('type', NotificationType::AccountMarketing->value)->where('channel', 'email')->first()?->enabled;
    $this->evenement = function (string $type, string $id = 'evt-1', string $email = 'awa@exemple.fr'): mixed {
        $corps = (string) json_encode(['events' => [[
            'event' => $type, 'event_id' => $id, 'email' => $email, 'message_id' => 'm-1', 'custom_variables' => ['delivery_id' => $this->envoi->id],
        ]]]);
        auth()->forgetGuards();

        return $this->call('POST', '/api/v1/webhooks/mail/mailtrap', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_MAILTRAP_SIGNATURE' => hash_hmac('sha256', $corps, C::SECRET_WEBHOOK),
        ], $corps);
    };
    auth()->forgetGuards();
});

it('affiche une page au nom d\'eGuardImmo sans rien changer', function (): void {
    $this->get($this->lien)->assertOk()->assertSee('eGuardImmo')->assertSee('Me désinscrire')->assertDontSee('bail')
        ->assertHeader('Cache-Control', 'no-store, private');

    expect(($this->accord)())->toBeTrue()->and($this->envoi->refresh()->unsubscribed_at)->toBeNull()->and(MailSuppression::query()->count())->toBe(0);
});

it('coupe la préférence e-mail du type en un clic, sans effet au rejeu', function (): void {
    $this->post($this->lien, [], ['Accept' => 'application/json'])->assertNoContent();
    $this->post($this->lien, [], ['Accept' => 'application/json'])->assertNoContent();

    expect(($this->accord)())->toBeFalse()
        ->and($this->envoi->refresh()->unsubscribed_at)->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'notifications.mail.unsubscribed')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'notifications.marketing_consent.changed')->count())->toBe(1)
        ->and(NotificationPreference::query()->where('type', NotificationType::AccountServiceMessage->value)->exists())->toBeFalse();

    $id = P::creer($this, $this->jeton, P::email(['audience' => 'selected', 'recipient_emails' => ['awa@exemple.fr']]));
    P::envoyer($this, $this->jeton, $id)->assertConflict()->assertJsonPath('code', 'platform_campaign_no_recipient');
});

it('confirme la désinscription à un navigateur et refuse un jeton falsifié', function (): void {
    $this->post($this->lien, [], ['Accept' => 'text/html'])->assertOk()->assertSee('eGuardImmo')->assertSee('Désinscription enregistrée');
    $this->post($this->lien.'x', [], ['Accept' => 'application/json'])->assertNotFound();
});

it('marque le rebond signalé par le fournisseur et oppose l\'adresse sur la plateforme', function (): void {
    ($this->evenement)('bounce')->assertOk()->assertJsonPath('data.processed', 1);
    ($this->evenement)('bounce')->assertJsonPath('data.duplicates', 1);

    expect($this->envoi->refresh()->status->value)->toBe('bounced')
        ->and($this->envoi->bounced_at)->not->toBeNull()
        ->and(MailSuppression::query()->where('scope_key', MailSuppression::PLATEFORME)->count())->toBe(1);

    $id = P::creer($this, $this->operateur['jeton'], P::email(['category' => 'service', 'audience' => 'selected', 'recipient_emails' => ['awa@exemple.fr']]));
    P::envoyer($this, $this->operateur['jeton'], $id)->assertConflict()->assertJsonPath('code', 'platform_campaign_no_recipient');
});

it('applique la désinscription signalée par le fournisseur à la préférence', function (): void {
    ($this->evenement)('unsubscribe')->assertOk();

    expect(($this->accord)())->toBeFalse()->and($this->envoi->refresh()->unsubscribed_at)->not->toBeNull();
});

it('ignore la ligne quand l\'adresse de l\'événement ne correspond pas', function (): void {
    ($this->evenement)('bounce', email: 'autre@exemple.fr')->assertOk();

    expect($this->envoi->refresh()->status->value)->toBe('sent');
});

it('compte la désinscription dans la fiche de la campagne', function (): void {
    $this->post($this->lien, [], ['Accept' => 'application/json'])->assertNoContent();

    ConsoleContext::lire($this, $this->jeton, P::URL."/{$this->campagne}")->assertJsonPath('data.stats.unsubscribed', 1);
});

it('efface l\'empreinte et le choix d\'un compte supprimé, sans effacer les lignes', function (): void {
    $brouillon = P::creer($this, $this->jeton, P::email(['audience' => 'selected', 'recipient_emails' => ['awa@exemple.fr']]));
    $this->awa->delete();

    event(new AccountDeleted($this->awa->id));

    expect($this->envoi->refresh()->email_hash)->toBeNull()
        ->and(PlatformCampaign::query()->findOrFail($brouillon)->recipient_user_ids)->toBe([])
        ->and(PlatformCampaign::query()->findOrFail($this->campagne)->recipient_user_ids)->toBe([$this->awa->id])
        ->and(PlatformCampaignDelivery::query()->count())->toBe(1);
});
