<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\CampaignsContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    C::fournisseur();
    $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->locataire = C::locataire($this->org, 'koffi@exemple.fr');
});

it('crée, lit, liste et modifie un brouillon', function (): void {
    $cree = C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps())
        ->assertCreated()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.audience', 'tenants')
        ->assertJsonPath('data.subject', 'Coupure d\'eau mardi')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.recipient_count', 0)
        ->assertJsonPath('data.created_by_user_id', $this->titulaire->id)
        ->assertJsonPath('data.attachments', []);
    $id = $cree->json('data.id');

    C::appeler($this, $this->org, $this->titulaire, 'GET', "/{$id}")->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('data.metrics.sent', 0);

    $liste = C::appeler($this, $this->org, $this->titulaire, 'GET')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id)
        ->assertJsonPath('counts.all', 1)->assertJsonPath('counts.draft', 1)->assertJsonPath('counts.sent', 0)
        ->assertJsonPath('stats.scheduled', 0)->assertJsonPath('stats.read_rate_percent', null);
    expect($liste->json('links'))->toBeArray();

    C::appeler($this, $this->org, $this->titulaire, 'PATCH', "/{$id}", C::corps(['subject' => 'Nouvel objet', 'lock_version' => 1]))
        ->assertOk()->assertJsonPath('data.subject', 'Nouvel objet')->assertJsonPath('data.lock_version', 2);

    expect(AuditLog::query()->whereIn('action', ['notifications.campaign.created', 'notifications.campaign.updated'])->pluck('action')->sort()->values()->all())
        ->toBe(['notifications.campaign.created', 'notifications.campaign.updated']);
});

it('refuse une modification faite sur une version périmée', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);

    C::appeler($this, $this->org, $this->titulaire, 'PATCH', "/{$id}", C::corps(['subject' => 'A', 'lock_version' => 1]))->assertOk();
    C::appeler($this, $this->org, $this->titulaire, 'PATCH', "/{$id}", C::corps(['subject' => 'B', 'lock_version' => 1]))
        ->assertStatus(409)->assertJsonPath('code', 'campaign_version_conflict');

    expect(Campaign::query()->findOrFail($id)->subject)->toBe('A');
});

it('refuse un champ de fusion inconnu, dont Loyer, dans l\'objet comme dans le corps', function (): void {
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['body' => 'Votre loyer : {{ Loyer }}']))
        ->assertUnprocessable()->assertJsonValidationErrors(['body']);
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['subject' => 'Bonjour {Impayé}']))
        ->assertUnprocessable()->assertJsonValidationErrors(['subject']);
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['audience' => 'mandants', 'body' => 'Bien : {Bien}']))
        ->assertUnprocessable()->assertJsonValidationErrors(['body']);

    expect(Campaign::query()->count())->toBe(0);
});

it('valide le corps en liste blanche et ne reçoit jamais de destinataires, de statut ni d\'organisation', function (): void {
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['audience' => 'debiteurs']))->assertUnprocessable();
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['subject' => '']))->assertUnprocessable();
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['lock_version' => 3]))->assertUnprocessable();
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['building_ids' => ['pas-un-uuid']]))->assertUnprocessable();

    $id = C::creer($this, $this->org, $this->titulaire, ['status' => 'sent', 'organization_id' => (string) Str::uuid(), 'recipients' => ['pirate@exemple.fr'], 'recipient_count' => 999, 'created_by_user_id' => (string) Str::uuid()]);
    $campagne = Campaign::query()->findOrFail($id);

    expect($campagne->status->value)->toBe('draft')
        ->and($campagne->organization_id)->toBe($this->org->id)
        ->and($campagne->recipient_count)->toBe(0)
        ->and($campagne->created_by_user_id)->toBe($this->titulaire->id);
});

it('refuse un immeuble qui n\'est pas à l\'organisation et une audience mandants avec immeubles', function (): void {
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['building_ids' => [(string) Str::uuid()]]))
        ->assertUnprocessable()->assertJsonValidationErrors(['building_ids']);
    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['audience' => 'mandants', 'body' => 'Bonjour', 'building_ids' => [(string) Str::uuid()]]))
        ->assertUnprocessable()->assertJsonValidationErrors(['building_ids']);
});

it('accepte un immeuble de l\'organisation', function (): void {
    $immeuble = C::appeler($this, $this->org, $this->titulaire, 'GET', '/audiences')->assertOk()->json('data.0.buildings.0.id');

    C::appeler($this, $this->org, $this->titulaire, 'POST', '', C::corps(['building_ids' => [$immeuble]]))
        ->assertCreated()->assertJsonPath('data.building_ids', [$immeuble]);
});

it('annonce les effectifs par audience, sans jamais lister de personne', function (): void {
    C::locataire($this->org);

    $reponse = C::appeler($this, $this->org, $this->titulaire, 'GET', '/audiences')->assertOk()
        ->assertJsonPath('data.0.audience', 'tenants')
        ->assertJsonPath('data.0.count', 2)
        ->assertJsonPath('data.0.without_email', 1)
        ->assertJsonCount(2, 'data.0.buildings')
        ->assertJsonPath('data.1.audience', 'mandants')
        ->assertJsonPath('data.1.count', 0);

    expect($reponse->getContent())->not->toContain('koffi@exemple.fr');
});

it('ne propose pas l\'audience mandants à un bailleur autonome', function (): void {
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);
    $bailleur = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Individual, 'Bailleur', 'FR'), 'Awa', 'Diallo');

    C::appeler($this, $bailleur, $titulaire, 'GET', '/audiences')->assertOk()->assertJsonCount(1, 'data');
    C::appeler($this, $bailleur, $titulaire, 'POST', '', C::corps(['audience' => 'mandants', 'body' => 'Bonjour']))
        ->assertUnprocessable()->assertJsonPath('code', 'campaign_audience_unavailable');
});

it('annule une diffusion programmée et refuse de modifier ce qui n\'est plus un brouillon', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);

    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/schedule", ['scheduled_at' => now()->addHour()->toIso8601String()], true)
        ->assertOk()->assertJsonPath('data.status', 'scheduled');
    C::appeler($this, $this->org, $this->titulaire, 'PATCH', "/{$id}", C::corps(['lock_version' => 1]))
        ->assertStatus(409)->assertJsonPath('code', 'campaign_not_editable');

    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
});

it('refuse de programmer à moins de 15 minutes ou sans date', function (): void {
    $id = C::creer($this, $this->org, $this->titulaire);

    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/schedule", ['scheduled_at' => now()->addMinutes(5)->toIso8601String()], true)
        ->assertUnprocessable()->assertJsonPath('code', 'campaign_schedule_invalid');
    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/schedule", [], true)->assertUnprocessable();
});

it('sans fournisseur configuré, une diffusion se crée et se programme mais ne part pas', function (): void {
    config(['notifications.campaigns.provider' => null]);
    $id = C::creer($this, $this->org, $this->titulaire);

    C::appeler($this, $this->org, $this->titulaire, 'POST', "/{$id}/schedule", ['scheduled_at' => now()->addHour()->toIso8601String()], true)
        ->assertOk()->assertJsonPath('data.status', 'scheduled');

    $this->travelTo(now()->addHours(2));
    $this->artisan('notifications:dispatch-campaigns')->assertSuccessful();

    expect(Campaign::query()->findOrFail($id)->status->value)->toBe('scheduled');

    $autre = C::creer($this, $this->org, $this->titulaire);
    C::envoyer($this, $this->org, $this->titulaire, $autre)->assertStatus(503)->assertJsonPath('code', 'campaign_sending_disabled');
    C::appeler($this, $this->org, $this->titulaire, 'POST', '/test', ['subject' => 'Essai', 'body' => 'Bonjour'], false)->assertStatus(503);
});
