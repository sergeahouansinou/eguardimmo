<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Support\Str;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->facture = C::emettre($this, $this->org, $this->partie);
});

dataset('routes', [
    'liste' => ['GET', '', null],
    'détail' => ['GET', '/{id}', null],
    'pdf' => ['GET', '/{id}/pdf', null],
    'brouillon' => ['POST', '', 'brouillon'],
    'modification' => ['PATCH', '/{id}', null],
    'émission' => ['POST', '/{id}/issue', null],
    'abandon' => ['POST', '/{id}/discard', null],
    'avoir' => ['POST', '/{id}/credit-notes', null],
    'règlement' => ['POST', '/{id}/payments', null],
    'envoi' => ['POST', '/{id}/send', null],
]);

it('401 sans jeton sur chaque route', function (string $verbe, string $chemin): void {
    auth()->forgetGuards();
    $this->app['auth']->forgetGuards();

    $this->json($verbe, C::url($this->org, str_replace('{id}', $this->facture->id, $chemin)))->assertUnauthorized();
})->with('routes');

it('404 sur l\'organisation pour un compte qui n\'en est pas membre', function (string $verbe, string $chemin): void {
    $autre = C::organisation(nom: 'Autre agence');
    C::basculer($this, $autre);

    $this->json($verbe, C::url($this->org, str_replace('{id}', $this->facture->id, $chemin)))->assertNotFound();
})->with('routes');

it('un gestionnaire lit et écrit, mais n\'émet pas d\'avoir', function (): void {
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->actingAs($gestionnaire);

    $this->getJson(C::url($this->org))->assertOk();
    $this->postJson(C::url($this->org, '/'.$this->facture->id.'/credit-notes'), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-gestionnaire'])->assertForbidden();
});

it('un comptable émet un avoir', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Accountant));

    $this->postJson(C::url($this->org, '/'.$this->facture->id.'/credit-notes'), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-comptable'])->assertCreated();
});

it('404 sur la facture d\'une autre organisation', function (): void {
    $autre = C::organisation(nom: 'Autre agence');
    C::basculer($this, $autre);

    foreach ([['GET', ''], ['GET', '/pdf'], ['POST', '/issue'], ['POST', '/discard'], ['POST', '/send']] as [$verbe, $suffixe]) {
        $this->json($verbe, C::url($autre, "/{$this->facture->id}{$suffixe}"))->assertNotFound();
    }

    $destinataire = C::destinataire($autre);
    $this->patchJson(C::url($autre, "/{$this->facture->id}"), ['recipient_party_id' => $destinataire->id, 'lock_version' => 1, 'lines' => [C::ligne()]])->assertNotFound();
    $this->postJson(C::url($autre, "/{$this->facture->id}/payments"), ['amount' => 100, 'method' => 'cash', 'paid_on' => '2026-11-18', 'idempotency_key' => 'reglement-croise'])->assertNotFound();
    $this->postJson(C::url($autre, "/{$this->facture->id}/credit-notes"), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-croise'])->assertNotFound();
    $this->getJson(C::url($autre))->assertOk()->assertJsonCount(0, 'data');
});

it('404 sur le règlement d\'une autre organisation', function (): void {
    $reglement = C::regler($this, $this->org, $this->facture, 1000)->assertCreated()->json('data.id');
    $autre = C::organisation(nom: 'Autre agence');
    C::basculer($this, $autre);

    $this->postJson("/api/v1/org/{$autre->id}/invoice-payments/{$reglement}/cancel")->assertNotFound();
});

it('404 sur la partie, le bail ou le mandat d\'une autre organisation', function (): void {
    $autre = C::organisation(nom: 'Autre agence');
    $partieEtrangere = C::destinataire($autre);
    $bailEtranger = L::bail($autre);

    $this->postJson(C::url($this->org), C::brouillon($partieEtrangere))->assertNotFound();
    $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['lease_id' => $bailEtranger->id]))->assertNotFound();
    $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['mandate_id' => (string) Str::uuid7()]))->assertNotFound();
});

it('une organisation individuelle est refusée par l\'API', function (): void {
    $bailleur = C::organisation(OrganizationKind::Individual, false, 'Mme Martin');
    C::basculer($this, $bailleur);

    $this->getJson(C::url($bailleur))->assertForbidden()->assertJsonPath('code', 'invoicing_agency_only');
    $this->postJson(C::url($bailleur), C::brouillon($this->partie))->assertForbidden()->assertJsonPath('code', 'invoicing_agency_only');
});

it('les réponses sont privées et sans cache', function (): void {
    $reponse = $this->getJson(C::url($this->org, '/'.$this->facture->id))->assertOk();

    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and(Invoice::query()->count())->toBe(1);
});

it('401, 404 hors organisation et 404 inter-organisation sur l\'annulation d\'un règlement', function (): void {
    $reglement = C::regler($this, $this->org, $this->facture, 1000)->assertCreated()->json('data.id');
    $autre = C::organisation(nom: 'Autre agence');
    C::basculer($this, $autre);

    $this->postJson("/api/v1/org/{$this->org->id}/invoice-payments/{$reglement}/cancel")->assertNotFound();
    $this->postJson("/api/v1/org/{$autre->id}/invoice-payments/{$reglement}/cancel")->assertNotFound();

    auth()->forgetGuards();
    $this->app['auth']->forgetGuards();
    $this->postJson("/api/v1/org/{$this->org->id}/invoice-payments/{$reglement}/cancel")->assertUnauthorized();
});

it('une ligne ne peut pas citer la nature d\'une autre organisation', function (): void {
    $autre = C::organisation(nom: 'Autre agence');
    $natureEtrangere = L::dans($autre, fn (): string => Term::factory()->create([
        'organization_id' => $autre->id, 'vocabulary' => 'invoice_item', 'key' => 'prestation_privee', 'semantic_key' => 'service',
    ])->id);

    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['item_term_id' => $natureEtrangere])]))->assertNotFound();

    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');
    $this->patchJson(C::url($this->org, "/{$id}"), [
        'recipient_party_id' => $this->partie->id, 'lock_version' => 1, 'lines' => [C::ligne(10000, ['item_term_id' => $natureEtrangere])],
    ])->assertNotFound();
});
