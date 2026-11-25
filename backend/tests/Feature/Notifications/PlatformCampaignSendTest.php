<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Enums\SuppressionReason;
use App\Modules\Notifications\Jobs\DeliverPlatformCampaignBatch;
use App\Modules\Notifications\Mail\PlatformCampaignMail;
use App\Modules\Notifications\Models\MailSuppression;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Mime\Email;
use Tests\Feature\Console\ConsoleContext;
use Tests\Feature\Notifications\PlatformContext as P;

beforeEach(function (): void {
    $this->operateur = P::preparer($this);
    $this->jeton = $this->operateur['jeton'];
});

it('n\'envoie le marketing qu\'aux comptes qui ont donné leur accord', function (): void {
    Mail::fake();
    $abonne = P::abonne('awa@exemple.fr');
    $muet = P::compte('marc@exemple.fr');
    $nonConfirme = P::compte('nouveau@exemple.fr', ['email_verified_at' => null]);
    $rebond = P::abonne('rebond@exemple.fr');
    MailSuppression::query()->create(['scope_key' => MailSuppression::PLATEFORME, 'email_hash' => app(RecordAudit::class)->fingerprint('rebond@exemple.fr'), 'reason' => SuppressionReason::Bounce]);
    $id = P::creer($this, $this->jeton, P::email());

    ConsoleContext::lire($this, $this->jeton, P::URL."/{$id}/estimate")->assertOk()
        ->assertJsonPath('data', ['total' => 4, 'eligible' => 1, 'excluded_no_consent' => 2, 'excluded_unreachable' => 1]);

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)
        ->assertJsonPath('data.status', 'sent')
        ->assertJsonPath('data.recipient_count', 4)
        ->assertJsonPath('data.sent_count', 1)
        ->assertJsonPath('data.skipped_count', 3)
        ->assertJsonPath('data.failed_count', 0)
        ->assertJsonPath('data.stats.suppressed', 3)
        ->assertJsonPath('data.lock_version', 2);

    Mail::assertSent(PlatformCampaignMail::class, 1);
    Mail::assertSent(PlatformCampaignMail::class, function (PlatformCampaignMail $courrier): bool {
        return $courrier->hasTo('awa@exemple.fr') && $courrier->envelope()->from?->name === 'eGuardImmo'
            && $courrier->envelope()->from->address === 'diffusion@agence.test' && $courrier->desinscription !== null
            && str_contains($courrier->texte, 'https://eguardimmo.com/nouveautes');
    });

    $envois = P::envois($id);
    expect($envois)->not->toHaveKey($nonConfirme->id)
        ->and($envois[$abonne->id]->email_hash)->toBe(app(RecordAudit::class)->fingerprint('awa@exemple.fr'))
        ->and($envois[$muet->id]->error_code)->toBe('no_consent')
        ->and($envois[$rebond->id]->error_code)->toBe('suppression')
        ->and($envois->toJson())->not->toContain('exemple.fr');

    $audit = AuditLog::query()->where('action', 'console.marketing.campaign_sent')->firstOrFail();
    expect($audit->actor_user_id)->toBe($this->operateur['user']->id)->and(json_encode($audit->getAttributes()))->not->toContain('exemple.fr');
});

it('envoie une information de service à tous, sauf aux comptes qui l\'ont désactivée', function (): void {
    Mail::fake();
    P::compte('awa@exemple.fr');
    P::preference(P::compte('marc@exemple.fr'), NotificationType::AccountServiceMessage, NotificationChannel::Email, false);
    $id = P::creer($this, $this->jeton, P::email(['category' => 'service']));

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.sent_count', 2)->assertJsonPath('data.skipped_count', 1);

    Mail::assertSent(PlatformCampaignMail::class, 2);
    Mail::assertNotSent(PlatformCampaignMail::class, fn (PlatformCampaignMail $courrier): bool => $courrier->hasTo('marc@exemple.fr'));
});

it('ne double jamais un envoi rejoué', function (): void {
    Mail::fake();
    P::abonne('awa@exemple.fr');
    $id = P::creer($this, $this->jeton, P::email());

    P::envoyer($this, $this->jeton, $id)->assertStatus(202);
    P::envoyer($this, $this->jeton, $id, 2)->assertConflict()->assertJsonPath('code', 'platform_campaign_not_editable');
    DeliverPlatformCampaignBatch::dispatchSync($id, PlatformCampaignDelivery::query()->pluck('id')->all());
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}", P::email(['lock_version' => 2]))->assertConflict()->assertJsonPath('code', 'platform_campaign_not_editable');

    Mail::assertSent(PlatformCampaignMail::class, 1);
    expect(PlatformCampaignDelivery::query()->count())->toBe(2);
});

it('refuse un envoi périmé, sans destinataire, trop large ou sans fournisseur, sans rien créer', function (): void {
    Mail::fake();
    $id = P::creer($this, $this->jeton, P::email());

    P::envoyer($this, $this->jeton, $id, 7)->assertConflict()->assertJsonPath('code', 'platform_campaign_stale');
    P::envoyer($this, $this->jeton, $id)->assertConflict()->assertJsonPath('code', 'platform_campaign_no_recipient');

    P::abonne('awa@exemple.fr');
    P::abonne('marc@exemple.fr');
    config(['notifications.marketing.max_recipients' => 1]);
    P::envoyer($this, $this->jeton, $id)->assertUnprocessable()->assertJsonPath('code', 'platform_campaign_too_large');

    config(['notifications.campaigns.provider' => null]);
    P::envoyer($this, $this->jeton, $id)->assertStatus(503)->assertJsonPath('code', 'campaign_sending_disabled');
    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test")->assertStatus(503);

    Mail::assertNothingSent();
    expect(PlatformCampaignDelivery::query()->count())->toBe(0)->and(PlatformCampaign::query()->firstOrFail()->status->value)->toBe('draft');
});

it('envoie un essai au seul opérateur connecté, sans lien de désinscription', function (): void {
    Mail::fake();
    P::abonne('awa@exemple.fr');
    $id = P::creer($this, $this->jeton, P::email());

    ConsoleContext::ecrire($this, $this->jeton, 'POST', P::URL."/{$id}/test", ['email' => 'awa@exemple.fr'])->assertOk()->assertJsonPath('data.sent_to', 'ops@eguardimmo.test');

    Mail::assertSent(PlatformCampaignMail::class, 1);
    Mail::assertSent(PlatformCampaignMail::class, fn (PlatformCampaignMail $courrier): bool => $courrier->hasTo('ops@eguardimmo.test')
        && str_starts_with($courrier->objet, '[Test] ') && $courrier->desinscription === null);
    expect(PlatformCampaignDelivery::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'console.marketing.campaign_tested')->count())->toBe(1);
});

it('compose le message : images embarquées ou jointes, en-têtes de désinscription', function (): void {
    P::abonne('awa@exemple.fr');
    $id = P::deposer($this, $this->jeton, P::URL, [
        ...P::email(['html' => '<p>Bonjour <img src="cid:logo" alt="Logo"></p>']),
        'images' => ['logo' => P::png('logo.png'), 'plan' => P::png('plan.png', 6)],
    ])->assertCreated()->json('data.id');

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.sent_count', 1);

    $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(1);
    $message = $messages->first()->getOriginalMessage();
    assert($message instanceof Email);
    $brut = $messages->first()->toString();
    $envoi = PlatformCampaignDelivery::query()->where('status', 'sent')->firstOrFail();

    expect($message->getFrom()[0]->toString())->toBe('"eGuardImmo" <diffusion@agence.test>')
        ->and($message->getHeaders()->get('List-Unsubscribe')?->getBodyAsString())->toContain('/api/v1/mail/unsubscribe/')
        ->and($message->getHeaders()->get('List-Unsubscribe-Post')?->getBodyAsString())->toBe('List-Unsubscribe=One-Click')
        ->and($message->getHeaders()->get('X-MT-Custom-Variables')?->getBodyAsString())->toContain($envoi->id)
        ->and((string) $message->getHtmlBody())->toContain('Ne plus recevoir ces e-mails')
        ->and((string) $message->getTextBody())->toContain('[Logo]')
        ->and($brut)->toContain('multipart/related')->toContain('Content-ID: <')->toContain('filename=logo.png')->toContain('filename=plan.png')
        ->and($brut)->not->toContain('src=3D"cid:'.PlatformCampaign::query()->findOrFail($id)->images->first()->id.'"')
        ->and($envoi->provider_message_id)->not->toBeNull();
});

it('marque en échec un envoi refusé par le transport', function (): void {
    P::abonne('awa@exemple.fr');
    $id = P::creer($this, $this->jeton, P::email());
    config(['notifications.campaigns.bulk_mailer' => 'inexistant']);

    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.failed_count', 1)->assertJsonPath('data.status', 'sent');
    expect(PlatformCampaignDelivery::query()->where('status', 'failed')->firstOrFail()->error_code)->toBe('transport');
});

it('reprend une campagne interrompue sans renvoyer une issue inconnue', function (): void {
    Mail::fake();
    Queue::fake();
    $awa = P::abonne('awa@exemple.fr');
    $marc = P::abonne('marc@exemple.fr');
    $id = P::creer($this, $this->jeton, P::email(['audience' => 'selected', 'recipient_emails' => ['awa@exemple.fr', 'marc@exemple.fr']]));
    P::envoyer($this, $this->jeton, $id)->assertStatus(202)->assertJsonPath('data.status', 'sending');
    PlatformCampaignDelivery::query()->where('user_id', $awa->id)->update(['status' => 'sending', 'attempted_at' => now()->format('Y-m-d H:i:s.u')]);

    $this->artisan('notifications:resume-platform-campaigns')->assertSuccessful();
    Queue::assertPushed(DeliverPlatformCampaignBatch::class, 1);

    $this->travel(31)->minutes();
    $this->artisan('notifications:resume-platform-campaigns')->assertSuccessful();

    Queue::assertPushed(DeliverPlatformCampaignBatch::class, 2);
    $relance = Queue::pushed(DeliverPlatformCampaignBatch::class)->last();
    expect($relance->deliveryIds)->toBe([P::envois($id)[$marc->id]->id])
        ->and(P::envois($id)[$awa->id]->status->value)->toBe('unknown');

    app()->call([$relance, 'handle']);

    Mail::assertSent(PlatformCampaignMail::class, 1);
    expect(PlatformCampaign::query()->findOrFail($id)->status->value)->toBe('sent');
});
