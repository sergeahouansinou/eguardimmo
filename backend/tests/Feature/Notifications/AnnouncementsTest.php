<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\CampaignDelivery;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    L::semer();
    C::fournisseur();
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->locataire = C::locataire($this->org, 'koffi@exemple.fr');
    $this->etranger = C::locataire($this->org, 'ama@exemple.fr');
    $this->autreOrg = T::organisation('Autre agence');
    $this->hors = C::locataire($this->autreOrg, 'hors@exemple.fr');

    $this->id = C::creer($this, $this->org, $this->titulaire);
    O::navigateurAgence($this);
    O::comme($this, $this->titulaire);
    $this->post(C::url($this->org, "/{$this->id}/attachments"), ['file' => C::pdf('Avis.pdf')], ['Accept' => 'application/json'])->assertCreated();
    $this->piece = $this->getJson(C::url($this->org, "/{$this->id}"))->json('data.attachments.0.id');
    C::envoyer($this, $this->org, $this->titulaire, $this->id)->assertOk();
});

function annonces(object $test, $compte, string $suite = '', string $espace = 'tenant'): TestResponse
{
    return O::comme($test, $compte)->getJson("/api/v1/{$espace}/announcements{$suite}");
}

it('liste, lit et marque lue une annonce reçue, avec le texte fusionné et ses pièces', function (): void {
    $prenom = $this->locataire['party']->first_name;

    $liste = annonces($this, $this->locataire['user'])->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->id)
        ->assertJsonPath('data.0.subject', 'Coupure d\'eau mardi')
        ->assertJsonPath('data.0.organization_name', 'Agence du Port')
        ->assertJsonPath('data.0.unread', true)
        ->assertJsonPath('data.0.attachments.0.id', $this->piece)
        ->assertJsonPath('data.0.attachments.0.name', 'Avis.pdf');
    expect($liste->json('data.0.body'))->toStartWith('Bonjour '.$prenom.', l\'eau sera coupée mardi pour ');

    annonces($this, $this->locataire['user'], "/{$this->id}")->assertOk()->assertJsonPath('data.unread', true);

    O::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/announcements/{$this->id}/read")->assertOk()->assertJsonPath('data.unread', false);
    O::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/announcements/{$this->id}/read")->assertOk()->assertJsonPath('data.unread', false);

    $lues = CampaignDelivery::query()->withoutGlobalScopes()->where('campaign_id', $this->id)->whereNotNull('read_at')->get();
    expect($lues)->toHaveCount(1)->and($lues->first()->user_id)->toBe($this->locataire['user']->id);

    C::appeler($this, $this->org, $this->titulaire, 'GET')->assertOk()
        ->assertJsonPath('data.0.metrics.read', 1)->assertJsonPath('stats.read_count', 1)->assertJsonPath('stats.sent_count', 2)->assertJsonPath('stats.read_rate_percent', 50);
});

it('sert la pièce à son destinataire seulement', function (): void {
    $reponse = O::comme($this, $this->locataire['user'])->get("/api/v1/tenant/announcements/{$this->id}/attachments/{$this->piece}")->assertOk();

    expect($reponse->streamedContent())->toBe("%PDF-1.4\n% avis aux locataires\n")->and($reponse->headers->get('Cache-Control'))->toContain('private');
});

it('répond 404 à un compte qui n\'a pas reçu l\'annonce, sans rien divulguer', function (): void {
    annonces($this, $this->hors['user'])->assertOk()->assertJsonCount(0, 'data');
    annonces($this, $this->titulaire)->assertForbidden();

    foreach ([$this->hors['user']] as $compte) {
        annonces($this, $compte, "/{$this->id}")->assertNotFound()->assertJsonPath('code', 'announcement_not_found');
        O::comme($this, $compte)->postJson("/api/v1/tenant/announcements/{$this->id}/read")->assertNotFound();
        O::comme($this, $compte)->get("/api/v1/tenant/announcements/{$this->id}/attachments/{$this->piece}")->assertNotFound();
    }

    expect(CampaignDelivery::query()->withoutGlobalScopes()->whereNotNull('read_at')->count())->toBe(0);
});

it('ne mélange pas les annonces d\'un locataire avec celles d\'un autre locataire de la même agence', function (): void {
    O::comme($this, $this->etranger['user'])->postJson("/api/v1/tenant/announcements/{$this->id}/read")->assertOk();

    expect(CampaignDelivery::query()->withoutGlobalScopes()->whereNotNull('read_at')->pluck('user_id')->all())->toBe([$this->etranger['user']->id]);

    annonces($this, $this->locataire['user'], "/{$this->id}")->assertOk()->assertJsonPath('data.unread', true);
});

it('exige une connexion, un espace locataire pour les annonces locataire', function (): void {
    auth()->forgetGuards();
    $this->getJson('/api/v1/tenant/announcements')->assertUnauthorized();
    $this->getJson('/api/v1/owner/announcements')->assertUnauthorized();
    $this->postJson("/api/v1/tenant/announcements/{$this->id}/read")->assertUnauthorized();

    annonces($this, $this->locataire['user'], '', 'owner')->assertForbidden();
});

it('livre aux mandants les annonces de l\'audience mandants dans leur espace propriétaire', function (): void {
    $proprietaire = O::proprietaire($this->org);
    $mandants = C::creer($this, $this->org, $this->titulaire, ['audience' => 'mandants', 'subject' => 'Relevé de gestion', 'body' => 'Bonjour {Prénom}, votre relevé de {Mois} est prêt.']);
    C::envoyer($this, $this->org, $this->titulaire, $mandants)->assertOk()->assertJsonPath('data.metrics.sent', 1);

    $reponse = annonces($this, $proprietaire['user'], '', 'owner')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mandants)->assertJsonPath('data.0.subject', 'Relevé de gestion');
    expect($reponse->json('data.0.body'))->toContain('novembre 2026');

    O::comme($this, $proprietaire['user'])->postJson("/api/v1/owner/announcements/{$mandants}/read")->assertOk()->assertJsonPath('data.unread', false);
    annonces($this, $this->locataire['user'], '', 'tenant')->assertJsonCount(1, 'data');
});

it('répond 404 pour une diffusion qu\'il n\'a pas reçue, même s\'il a reçu une autre annonce', function (): void {
    $inconnue = (string) Str::uuid();
    $nonEnvoyee = C::creer($this, $this->org, $this->titulaire, ['subject' => 'Brouillon interne']);

    foreach ([$inconnue, $nonEnvoyee] as $campagne) {
        annonces($this, $this->locataire['user'], "/{$campagne}")->assertNotFound()->assertJsonPath('code', 'announcement_not_found');
        O::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/announcements/{$campagne}/read")->assertNotFound();
    }
});
