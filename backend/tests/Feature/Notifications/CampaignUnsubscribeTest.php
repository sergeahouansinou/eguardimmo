<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\MailSuppression;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
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
    $this->jeton = app(UnsubscribeToken::class)->issue($this->envoi);
    $this->url = '/api/v1/mail/unsubscribe/'.$this->jeton;
    auth()->forgetGuards();
});

it('désinscrit en un clic (POST sans authentification) et reste sans effet au second appel', function (): void {
    $this->postJson($this->url)->assertNoContent();
    $this->postJson($this->url)->assertNoContent();

    $lignes = MailSuppression::query()->get();
    expect($lignes)->toHaveCount(1)
        ->and($lignes->first()->scope_key)->toBe($this->org->id)
        ->and($lignes->first()->reason->value)->toBe('unsubscribed')
        ->and($lignes->first()->email_hash)->not->toContain('koffi')
        ->and(AuditLog::query()->where('action', 'notifications.mail.unsubscribed')->count())->toBe(1);
});

it('la page de désinscription n\'a aucun effet tant qu\'on ne confirme pas', function (): void {
    $this->get($this->url, ['Accept' => 'text/html'])->assertOk()
        ->assertSee('Agence du Port')->assertSee('Me désinscrire')
        ->assertHeader('Cache-Control', 'no-store, private');

    expect(MailSuppression::query()->count())->toBe(0);

    $this->post($this->url, [], ['Accept' => 'text/html'])->assertOk()->assertSee('Désinscription enregistrée');
    expect(MailSuppression::query()->count())->toBe(1);
});

it('refuse un jeton falsifié, mal formé ou échu comme un jeton inconnu', function (): void {
    [$charge] = explode('.', $this->jeton);

    foreach ([$charge.'.'.str_repeat('0', 64), 'nimporte-quoi', $charge, $this->jeton.'x', 'a.b'] as $mauvais) {
        $this->postJson('/api/v1/mail/unsubscribe/'.$mauvais)->assertNotFound()->assertJsonPath('code', 'unsubscribe_token_invalid');
    }

    $this->get('/api/v1/mail/unsubscribe/nimporte-quoi', ['Accept' => 'text/html'])->assertNotFound()->assertSee('Lien invalide');

    $this->travelTo(now()->addDays(401));
    $this->postJson($this->url)->assertNotFound()->assertJsonPath('code', 'unsubscribe_token_invalid');

    expect(MailSuppression::query()->count())->toBe(0);
});

it('refuse tout jeton quand la clé de signature n\'est pas configurée', function (): void {
    config(['notifications.campaigns.unsubscribe_key' => '']);

    $this->postJson($this->url)->assertNotFound();
    expect(MailSuppression::query()->count())->toBe(0);
});

it('ne désinscrit que de l\'organisation qui a écrit', function (): void {
    $this->postJson($this->url)->assertNoContent();

    $autre = T::organisation('Autre agence');
    C::locataire($autre, 'koffi@exemple.fr');
    $titulaire = C::titulaire($autre);
    $id = C::creer($this, $autre, $titulaire);
    Mail::fake();
    C::envoyer($this, $autre, $titulaire, $id)->assertOk()->assertJsonPath('data.metrics.sent', 1);
});

it('limite les appels par jeton, sans bloquer les autres jetons derrière la même adresse IP', function (): void {
    foreach (range(1, 30) as $n) {
        $this->postJson($this->url)->assertNoContent();
    }

    $this->postJson($this->url)->assertStatus(429);

    foreach (range(1, 45) as $n) {
        $this->postJson('/api/v1/mail/unsubscribe/inconnu-'.$n)->assertStatus(404);
    }
});
