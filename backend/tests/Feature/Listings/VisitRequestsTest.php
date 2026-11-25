<?php

declare(strict_types=1);

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Listings\Enums\LeadStatus;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Events\VisitRequested;
use App\Modules\Listings\Models\ListingFavorite;
use App\Modules\Listings\Models\ListingLead;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org);
    $this->moi = M::voyageur();
    $this->url = "/api/v1/marketplace/listings/{$this->annonce->public_ref}/visit-requests";
    $this->corps = ['requested_slot' => 'Samedi matin', 'message' => 'Bonjour, je souhaite visiter.'];
});

it('exige un compte connecté et un e-mail vérifié', function (): void {
    $this->postJson($this->url, $this->corps)->assertUnauthorized();

    $this->actingAs(User::factory()->unverified()->create())->postJson($this->url, $this->corps)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    expect(AcrossOrganizations::query(ListingLead::class)->count())->toBe(0);
});

it('enregistre la demande chez l\'organisation de l\'annonce et prévient par événement', function (): void {
    Event::fake([VisitRequested::class]);
    $autre = C::organisation();

    $reponse = $this->actingAs($this->moi)->postJson($this->url, [...$this->corps, 'organization_id' => $autre->id, 'user_id' => (string) fake()->uuid(), 'status' => 'answered'])->assertCreated();

    expect($reponse->json('data.status'))->toBe('new')->and($reponse->json('data.requested_slot'))->toBe('Samedi matin');
    $demande = AcrossOrganizations::query(ListingLead::class)->findOrFail($reponse->json('data.id'));
    expect($demande->organization_id)->toBe($this->org->id)
        ->and($demande->user_id)->toBe($this->moi->id)
        ->and($demande->listing_id)->toBe($this->annonce->id)
        ->and($demande->status)->toBe(LeadStatus::New)
        ->and($demande->message)->toBe('Bonjour, je souhaite visiter.');
    Event::assertDispatched(VisitRequested::class, fn (VisitRequested $e): bool => $e->leadId === $demande->id && $e->organizationId === $this->org->id);
});

it('accepte un message de plusieurs lignes', function (): void {
    $this->actingAs($this->moi)->postJson($this->url, ['requested_slot' => 'Samedi', 'message' => "Bonjour,\n\nMerci de votre retour."])->assertCreated();
});

it('journalise la demande sans le message ni le créneau en clair', function (): void {
    $id = $this->actingAs($this->moi)->postJson($this->url, $this->corps)->assertCreated()->json('data.id');

    $journal = AuditLog::query()->where('subject_id', $id)->get();

    expect($journal)->not->toBeEmpty()
        ->and(json_encode($journal->toArray(), JSON_THROW_ON_ERROR))->not->toContain('Bonjour, je souhaite visiter.')->not->toContain('Samedi matin');
});

it('accepte une demande sans message', function (): void {
    $this->actingAs($this->moi)->postJson($this->url, ['requested_slot' => 'Dimanche'])->assertCreated();
});

it('refuse le HTML, les textes trop longs et les champs manquants', function (array $corps): void {
    $this->actingAs($this->moi)->postJson($this->url, $corps)->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
})->with([
    'sans créneau' => [['message' => 'Bonjour']],
    'balise dans le message' => [['requested_slot' => 'Samedi', 'message' => '<img src=x onerror=alert(1)>']],
    'balise dans le créneau' => [['requested_slot' => '<b>Samedi</b>']],
    'créneau trop long' => [['requested_slot' => str_repeat('a', 121)]],
    'saut de ligne dans le créneau' => [['requested_slot' => "Samedi\nmatin"]],
    'caractère de contrôle dans le message' => [['requested_slot' => 'Samedi', 'message' => "Bon\u{0000}jour"]],
    'retour chariot dans le message' => [['requested_slot' => 'Samedi', 'message' => "Bonjour\r\nMerci"]],
    'texte bidirectionnel dans le message' => [['requested_slot' => 'Samedi', 'message' => "Bonjour\u{202E}"]],
    'message trop long' => [['requested_slot' => 'Samedi', 'message' => str_repeat('a', 1001)]],
]);

it('répond 404 pour une annonce non publiée ou inconnue', function (): void {
    $brouillon = M::annonce($this->org, [], ListingStatus::Draft);

    $this->actingAs($this->moi);
    $this->postJson("/api/v1/marketplace/listings/{$brouillon->public_ref}/visit-requests", $this->corps)->assertNotFound();
    $this->postJson('/api/v1/marketplace/listings/abcdefghjkmn/visit-requests', $this->corps)->assertNotFound();
});

it('limite à 5 demandes par heure et par compte', function (): void {
    $this->actingAs($this->moi);

    foreach (range(1, 5) as $_) {
        $this->postJson($this->url, $this->corps)->assertCreated();
    }

    $this->postJson($this->url, $this->corps)->assertTooManyRequests()->assertJsonPath('code', 'too_many_requests');
    $this->actingAs(M::voyageur())->postJson($this->url, $this->corps)->assertCreated();
});

it('efface les favoris et le texte des demandes d\'un compte supprimé, sans toucher aux autres', function (): void {
    $autre = M::voyageur();
    foreach ([$this->moi, $autre] as $compte) {
        ListingFavorite::query()->create(['user_id' => $compte->id, 'listing_id' => $this->annonce->id]);
        $this->actingAs($compte)->postJson($this->url, $this->corps)->assertCreated();
    }

    AccountDeleted::dispatch($this->moi->id);

    expect(ListingFavorite::query()->where('user_id', $this->moi->id)->count())->toBe(0)
        ->and(ListingFavorite::query()->where('user_id', $autre->id)->count())->toBe(1);
    $siennes = AcrossOrganizations::query(ListingLead::class)->where('user_id', $this->moi->id)->first();
    $autres = AcrossOrganizations::query(ListingLead::class)->where('user_id', $autre->id)->first();
    expect($siennes?->message)->toBeNull()->and($siennes?->requested_slot)->toBe('')->and($autres?->message)->toBe('Bonjour, je souhaite visiter.');
});
