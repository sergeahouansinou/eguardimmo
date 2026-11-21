<?php

declare(strict_types=1);

use App\Modules\Notifications\Actions\SendCampaignDeliveries;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Support\CampaignQuota;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Shared\Audit\AuditLog;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    L::semer();
    C::fournisseur();
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->avecCompte = C::locataire($this->org, 'koffi@exemple.fr');
    $this->sansEmail = C::locataire($this->org);
    $this->sansCompte = T::colocataire($this->org, $this->avecCompte['lease']);
    T::emailPrincipal($this->org, $this->sansCompte, 'fiche@exemple.fr');
});

function destinataires(): array
{
    return Mail::sent(CampaignMail::class)->map(fn (CampaignMail $m): string => $m->to[0]['address'])->sort()->values()->all();
}

it('envoie une diffusion à chaque destinataire une seule fois, avec ses champs de fusion et sa désinscription', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk()->assertJsonPath('data.recipient_count', 3);

    expect(destinataires())->toBe(['fiche@exemple.fr', 'koffi@exemple.fr']);

    $campagne = C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$id}")->assertOk()
        ->assertJsonPath('data.status', 'sent')
        ->assertJsonPath('data.metrics.sent', 2)
        ->assertJsonPath('data.metrics.skipped_no_email', 1)
        ->assertJsonPath('data.metrics.queued', 0)
        ->assertJsonPath('data.recipient_count', 3)
        ->assertJsonPath('data.failed_count', 0);
    expect($campagne->json('data.sent_at'))->not->toBeNull();

    $courrier = Mail::sent(CampaignMail::class)->first(fn (CampaignMail $m): bool => $m->to[0]['address'] === 'koffi@exemple.fr');
    $prenom = $this->avecCompte['party']->first_name;
    $courrier->assertHasSubject('Coupure d\'eau mardi')->assertSeeInText('Bonjour '.$prenom.',');
    expect($courrier->headers()->text['List-Unsubscribe'])->toStartWith('<'.url('/api/v1/mail/unsubscribe/'))
        ->and($courrier->headers()->text['List-Unsubscribe-Post'])->toBe('List-Unsubscribe=One-Click')
        ->and($courrier->desinscription)->not->toContain($courrier->to[0]['address']);
});

it('ne met aucun pixel ni lien de suivi dans le message : seulement la désinscription et le lien de l\'espace', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    foreach (Mail::sent(CampaignMail::class) as $courrier) {
        $texte = $courrier->render();
        preg_match_all('#https?://[^\s<>"]+#', $texte, $liens);

        expect($texte)->not->toContain('<img')->not->toContain('<a ')
            ->and(array_filter($liens[0], fn (string $lien): bool => ! str_contains($lien, '/api/v1/mail/unsubscribe/') && ! str_starts_with($lien, 'https://locataire.eguardimmo.test/annonces/')))->toBe([]);
    }
});

it('rejoué, un paquet, la reprise ou un second envoi n\'adresse jamais deux fois le même destinataire', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
    $lignes = C::envois($this->org, $id)->pluck('id')->all();

    L::dans($this->org, fn () => app(SendCampaignDeliveries::class)->handle($id, $lignes));
    $this->artisan('notifications:resume-campaigns')->assertSuccessful();
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertStatus(409)->assertJsonPath('code', 'campaign_not_editable');

    expect(destinataires())->toBe(['fiche@exemple.fr', 'koffi@exemple.fr'])
        ->and(C::envois($this->org, $id))->toHaveCount(3);
});

it('écarte une adresse désinscrite ou en rebond avant l\'envoi, sans l\'envoyer', function (): void {
    $premiere = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $premiere)->assertOk();
    $envoi = C::envois($this->org, $premiere)->first(fn ($l): bool => $l->email === 'koffi@exemple.fr');
    $this->postJson('/api/v1/mail/unsubscribe/'.app(UnsubscribeToken::class)->issue($envoi))->assertNoContent();
    Mail::fake();

    $seconde = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Deuxième information']);
    C::envoyer($this, $this->org, $this->titulaire, $seconde)->assertOk()
        ->assertJsonPath('data.metrics.suppressed', 1)->assertJsonPath('data.metrics.sent', 1);

    expect(destinataires())->toBe(['fiche@exemple.fr']);
});

it('refuse d\'envoyer sans destinataire', function (): void {
    $titulaire = T::organisation('Agence vide');
    $vide = C::titulaire($titulaire);
    $id = C::creer($this, $titulaire, $vide);

    C::envoyer($this, $titulaire, $vide, $id)->assertUnprocessable()->assertJsonPath('code', 'campaign_audience_empty');

    expect(Campaign::query()->findOrFail($id)->status->value)->toBe('draft');
});

it('plafonne les destinataires sur 24 heures sans rien figer ni envoyer', function (): void {
    config(['notifications.campaigns.daily_recipients' => 1]);
    $id = C::creer($this, $this->org, $this->titulaire);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertStatus(429)->assertJsonPath('code', 'campaign_quota_reached')->assertHeader('Retry-After');

    expect(Campaign::query()->findOrFail($id)->status->value)->toBe('draft')
        ->and(C::envois($this->org, $id))->toHaveCount(0)
        ->and(destinataires())->toBe([]);

    config(['notifications.campaigns.daily_recipients' => 2]);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
});

it('plafonne le nombre d\'envois par heure et par organisation', function (): void {
    config(['notifications.campaigns.hourly_sends' => 2]);

    foreach ([1, 2] as $n) {
        C::envoyer($this, $this->org, $this->titulaire, C::creer($this, $this->org, $this->titulaire, ['subject' => "Information {$n}"]))->assertOk();
    }

    $id = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Information 3']);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertStatus(429)->assertJsonPath('code', 'campaign_quota_reached');

    $this->travelTo(now()->addMinutes(61));
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
});

it('un échec du transport marque la ligne en échec sans interrompre les autres', function (): void {
    Mail::shouldReceive('mailer')->andReturnUsing(fn () => throw new RuntimeException('Transport indisponible'));
    $id = C::creer($this, $this->org, $this->titulaire);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    $lignes = C::envois($this->org, $id);
    expect($lignes->where('status.value', 'failed')->count())->toBe(2)
        ->and($lignes->pluck('error_code')->filter()->unique()->all())->toBe(['transport'])
        ->and(Campaign::query()->findOrFail($id)->failed_count)->toBe(2);
});

it('ne rapporte jamais le message brut du transport, qui peut contenir l\'adresse du destinataire', function (): void {
    Exceptions::fake();
    Log::spy();
    Mail::shouldReceive('mailer')->andReturnUsing(fn () => throw new RuntimeException('550 Mailbox koffi@exemple.fr introuvable'));
    $id = C::creer($this, $this->org, $this->titulaire);

    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    Exceptions::assertNothingReported();
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $contexte): bool => ! str_contains(json_encode($contexte), '@') && $contexte['error'] === RuntimeException::class);
});

it('envoie un test à l\'adresse de l\'auteur seulement, avec des valeurs d\'exemple, dans la limite de 5 par heure', function (): void {
    $reponse = C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai {Prénom}', 'body' => 'Bonjour {Prénom}', 'to' => 'pirate@exemple.fr', 'recipients' => ['pirate@exemple.fr']])
        ->assertOk()->assertJsonPath('data.sent_to', $this->titulaire->email)->assertJsonPath('data.subject', 'Essai {Prénom}');

    expect(destinataires())->toBe([$this->titulaire->email]);
    Mail::sent(CampaignMail::class)->first()->assertHasSubject('[Test] Essai Koffi')->assertSeeInText('Bonjour Koffi');
    expect(C::envois($this->org, (string) Str::uuid()))->toHaveCount(0);

    foreach ([2, 3, 4, 5] as $n) {
        C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai', 'body' => 'Bonjour'])->assertOk();
    }

    C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai', 'body' => 'Bonjour'])->assertStatus(429);
});

it('applique la limite horaire des tests configurée', function (): void {
    config(['notifications.campaigns.hourly_tests' => 2]);

    foreach ([1, 2] as $n) {
        C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai', 'body' => 'Bonjour'])->assertOk();
    }

    C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai', 'body' => 'Bonjour'])->assertStatus(429);
});

it('journalise l\'envoi sans adresse ni contenu', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();

    $journal = AuditLog::query()->where('action', 'notifications.campaign.sent')->firstOrFail();

    expect($journal->actor_user_id)->toBe($this->titulaire->id)
        ->and($journal->organization_id)->toBe($this->org->id)
        ->and($journal->subject_id)->toBe($id)
        ->and(json_encode($journal->metadata))->not->toContain('@')->not->toContain('Coupure');
});

it('crée une annonce dans l\'espace du compte seulement quand la diffusion garde une copie', function (): void {
    $sans = C::creer($this, $this->org, $this->titulaire, ['copy_to_history' => false, 'subject' => 'Sans copie']);
    C::envoyer($this, $this->org, $this->titulaire, $sans)->assertOk();

    expect(Notification::query()->where('type', 'tenant.announcement')->count())->toBe(0);

    $avec = C::creer($this, $this->org, $this->titulaire, ['copy_to_history' => true, 'subject' => 'Avec copie']);
    C::envoyer($this, $this->org, $this->titulaire, $avec)->assertOk();

    expect(Notification::query()->where('type', 'tenant.announcement')->pluck('user_id')->sort()->values()->all())
        ->toBe(collect([$this->avecCompte['user']->id, $this->sansEmail['user']->id])->sort()->values()->all());
});

it('ne renvoie pas une ligne que le paquet d\'un autre processus vient de réserver', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $id)->assertOk();
    $lignes = C::envois($this->org, $id)->pluck('id')->all();
    Mail::fake();
    DB::table('campaign_deliveries')->where('campaign_id', $id)->update(['status' => 'queued']);
    Campaign::query()->whereKey($id)->update(['status' => 'sending']);
    Event::listen('eloquent.retrieved: '.CampaignDelivery::class, fn (CampaignDelivery $envoi) => DB::table('campaign_deliveries')->where('id', $envoi->id)->update(['status' => 'sent']));

    L::dans($this->org, fn () => app(SendCampaignDeliveries::class)->handle($id, $lignes));

    expect(destinataires())->toBe([]);
});

it('refuse de figer une diffusion quand le verrou du plafond a expiré avant la vérification', function (): void {
    $plafonds = app(CampaignQuota::class);

    $essai = fn () => L::dans($this->org, fn () => $plafonds->exclusive($this->org->id, function () use ($plafonds): void {
        Cache::lock('campaigns:quota:'.$this->org->id)->forceRelease();
        $plafonds->assertAvailable(1);
    }));

    expect($essai)->toThrow(ApiProblem::class);
    expect(fn () => L::dans($this->org, fn () => $plafonds->exclusive($this->org->id, fn () => $plafonds->assertAvailable(1))))->not->toThrow(ApiProblem::class);
});
