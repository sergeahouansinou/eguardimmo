<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\MailProviderEvent;
use App\Modules\Notifications\Models\MailSuppression;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Mail::fake();
    L::semer();
    C::fournisseur();
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->locataire = C::locataire($this->org, 'koffi@exemple.fr');
    $this->id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk();
    $this->envoi = C::envois($this->org, $this->id)->firstOrFail();
    auth()->forgetGuards();
});

function evenement(object $test, string $type, string $id, array $surcharge = []): array
{
    return ['event' => $type, 'event_id' => $id, 'email' => 'koffi@exemple.fr', 'message_id' => 'msg-1', 'custom_variables' => ['delivery_id' => $test->envoi->id], ...$surcharge];
}

function webhook(object $test, array $evenements, ?string $signature = null, ?string $corps = null): TestResponse
{
    $corps ??= json_encode(['events' => $evenements], JSON_UNESCAPED_UNICODE);
    $signature ??= hash_hmac('sha256', $corps, C::SECRET_WEBHOOK);

    return $test->call('POST', '/api/v1/webhooks/mail/mailtrap', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_MAILTRAP_SIGNATURE' => $signature], $corps);
}

it('refuse une requête sans signature valide, sans rien enregistrer', function (): void {
    $corps = json_encode(['events' => [evenement($this, 'bounce', 'e-1')]]);

    webhook($this, [], 'faux', $corps)->assertUnauthorized()->assertJsonPath('code', 'mail_webhook_unauthorized');
    webhook($this, [], hash_hmac('sha256', $corps, 'autre-secret'), $corps)->assertUnauthorized();
    webhook($this, [], hash_hmac('sha256', $corps.' ', C::SECRET_WEBHOOK), $corps)->assertUnauthorized();
    $this->call('POST', '/api/v1/webhooks/mail/mailtrap', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $corps)->assertUnauthorized();

    expect(MailProviderEvent::query()->count())->toBe(0)->and(MailSuppression::query()->count())->toBe(0);
});

it('refuse tout appel quand le secret du webhook n\'est pas configuré', function (): void {
    config(['notifications.campaigns.webhook_secrets.mailtrap' => '']);
    $corps = json_encode(['events' => [evenement($this, 'bounce', 'e-1')]]);

    webhook($this, [], hash_hmac('sha256', $corps, ''), $corps)->assertUnauthorized();
    expect(MailSuppression::query()->count())->toBe(0);
});

it('un rebond supprime l\'adresse pour toute la plateforme et marque la ligne, une seule fois', function (): void {
    webhook($this, [evenement($this, 'bounce', 'e-1')])->assertOk()->assertJsonPath('data.processed', 1)->assertJsonPath('data.duplicates', 0);
    webhook($this, [evenement($this, 'bounce', 'e-1')])->assertOk()->assertJsonPath('data.processed', 0)->assertJsonPath('data.duplicates', 1);

    $suppression = MailSuppression::query()->firstOrFail();
    $ligne = C::envois($this->org, $this->id)->first();
    expect(MailSuppression::query()->count())->toBe(1)
        ->and($suppression->scope_key)->toBe('platform')->and($suppression->reason->value)->toBe('bounce')->and($suppression->organization_id)->toBeNull()
        ->and(MailProviderEvent::query()->count())->toBe(1)
        ->and($ligne->status->value)->toBe('bounced')->and($ligne->bounced_at)->not->toBeNull();

    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$this->id}")->assertJsonPath('data.metrics.bounced', 1)->assertJsonPath('data.failed_count', 1);
});

it('une plainte supprime l\'adresse pour toute la plateforme', function (): void {
    webhook($this, [evenement($this, 'spam', 'e-2')])->assertOk()->assertJsonPath('data.processed', 1);

    expect(MailSuppression::query()->firstOrFail()->reason->value)->toBe('complaint')->and(MailSuppression::query()->firstOrFail()->scope_key)->toBe('platform');

    $autre = T::organisation('Autre agence');
    C::locataire($autre, 'koffi@exemple.fr');
    $id = C::creer($this, $autre, C::titulaire($autre));
    Mail::fake();
    C::envoyer($this, $autre, C::titulaire($autre), $id)->assertOk()->assertJsonPath('data.metrics.suppressed', 1)->assertJsonPath('data.metrics.sent', 0);
});

it('la désinscription du fournisseur ne vaut que pour l\'organisation de la diffusion', function (): void {
    webhook($this, [evenement($this, 'unsubscribe', 'e-3')])->assertOk()->assertJsonPath('data.processed', 1);

    expect(MailSuppression::query()->firstOrFail()->scope_key)->toBe($this->org->id)->and(MailSuppression::query()->firstOrFail()->reason->value)->toBe('unsubscribed');
});

it('ignore les ouvertures et les clics, et un corps qui n\'est pas une liste d\'événements', function (): void {
    webhook($this, [evenement($this, 'open', 'e-4'), evenement($this, 'click', 'e-5'), ['event' => 'bounce'], 'texte', ['event_id' => 'e-6']])
        ->assertOk()->assertJsonPath('data.processed', 0)->assertJsonPath('data.ignored', 5);

    expect(MailProviderEvent::query()->count())->toBe(0)->and(MailSuppression::query()->count())->toBe(0);

    webhook($this, [], null, '{"events": "oups"}')->assertUnprocessable()->assertJsonPath('code', 'mail_webhook_payload_invalid');
    webhook($this, [], null, 'pas du json')->assertUnprocessable();
    webhook($this, [], null, '{"events": {"a": 1}}')->assertUnprocessable();
});

it('n\'applique pas à la ligne un événement dont l\'adresse n\'est pas la sienne', function (): void {
    webhook($this, [evenement($this, 'bounce', 'e-7', ['email' => 'autre@exemple.fr'])])->assertOk()->assertJsonPath('data.processed', 1);

    expect(C::envois($this->org, $this->id)->first()->status->value)->toBe('sent')
        ->and(MailSuppression::query()->count())->toBe(1);
});

it('retrouve la ligne par l\'identifiant de message du fournisseur quand la variable est absente', function (): void {
    L::dans($this->org, fn () => $this->envoi->forceFill(['provider_message_id' => 'msg-xyz'])->save());

    webhook($this, [evenement($this, 'bounce', 'e-8', ['custom_variables' => [], 'message_id' => 'msg-xyz'])])->assertOk();

    expect(C::envois($this->org, $this->id)->first()->status->value)->toBe('bounced');
});

it('plafonne le nombre d\'événements traités par requête', function (): void {
    $evenements = array_map(fn (int $n): array => evenement($this, 'bounce', "lot-{$n}", ['email' => "a{$n}@exemple.fr", 'custom_variables' => []]), range(1, 510));

    webhook($this, $evenements)->assertOk()->assertJsonPath('data.processed', 500);
});

it('n\'est pas plafonné par la limite anonyme globale de l\'API : seul son limiteur dédié s\'applique', function (): void {
    foreach (range(1, 80) as $n) {
        $this->postJson('/api/v1/webhooks/mail/mailtrap', ['events' => []], ['Mailtrap-Signature' => 'invalide'])->assertUnauthorized();
    }
});
