<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext;
use Tests\Feature\Recovery\RecoveryContext as X;

beforeEach(function (): void {
    X::preparer($this);
});

/**
 * Trois échéances impayées (700,00 EUR chacune) et une facture de bail échue (120,00 EUR TTC).
 *
 * @return array{org: Organization, bail: Lease, locataire: Party, ids: list<string>, facture: string}
 */
function scenarioFacture(object $test): array
{
    $s = X::impayes($test);

    return [...$s, 'facture' => X::facturer($test, $s['org'], $s['bail'], $s['locataire'])];
}

function payerFacture(object $test, object $org, string $factureId, int $montant): TestResponse
{
    return I::regler($test, $org, L::dans($org, fn () => Invoice::query()->findOrFail($factureId)), $montant, ['paid_on' => '2026-11-16']);
}

function creancesRevendiquees(string $organisationId): int
{
    return DB::table('recovery_item_claims')->where('organization_id', $organisationId)->count();
}

it('liste la facture de bail échue avec les échéances, type et reste dû lus au grand livre', function (): void {
    $s = scenarioFacture($this);
    X::basculer($this, $s['org']);
    payerFacture($this, $s['org'], $s['facture'], 2000)->assertCreated();

    $reponse = $this->getJson(X::url($s['org'], '/unpaid'))->assertOk();
    $lignes = collect($reponse->json('data'));
    $facture = $lignes->firstWhere('type', 'invoice');

    expect($lignes)->toHaveCount(4)
        ->and($lignes->pluck('item_id')->all())->toBe($lignes->pluck('item_id')->sort()->values()->all())
        ->and($lignes->where('type', 'installment')->pluck('installment_id')->sort()->values()->all())->toBe(collect($s['ids'])->sort()->values()->all())
        ->and($facture['item_id'])->toBe($s['facture'])
        ->and($facture['invoice_id'])->toBe($s['facture'])
        ->and($facture['installment_id'])->toBeNull()
        ->and($facture['reference'])->toBe('FA-2026-0001')
        ->and($facture['period'])->toBeNull()
        ->and($facture['issued_on'])->toBe('2026-10-01')
        ->and($facture['due_date'])->toBe('2026-10-15')
        ->and($facture['days_overdue'])->toBe(32)
        ->and($facture['total']['amount'])->toBe(12000)
        ->and($facture['outstanding']['amount'])->toBe(10000)
        ->and($facture['lease']['reference'])->toBe($s['bail']->reference)
        ->and($facture['party']['id'])->toBe($s['locataire']->id)
        ->and($facture['case'])->toBeNull()
        ->and($lignes->firstWhere('type', 'installment')['invoice_id'])->toBeNull()
        ->and($lignes->firstWhere('type', 'installment')['period'])->not->toBeNull();
});

it('pagine échéances et factures ensemble sans rien perdre ni répéter', function (): void {
    $s = scenarioFacture($this);
    X::facturer($this, $s['org'], $s['bail'], $s['locataire'], '2026-10-20');
    X::basculer($this, $s['org']);
    $vus = [];
    $apres = null;

    do {
        $page = $this->getJson(X::url($s['org'], '/unpaid?per_page=2'.($apres === null ? '' : "&after={$apres}")))->assertOk();
        $vus = [...$vus, ...array_column($page->json('data'), 'item_id')];
        $apres = $page->json('meta.next_after');
    } while ($apres !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5)->and($vus)->toContain($s['facture'], ...$s['ids']);
});

it('ouvre un dossier avec échéances et facture : montants relus au grand livre, ligne et revendication écrites', function (): void {
    $s = scenarioFacture($this);

    $reponse = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]], [$s['facture']])->assertCreated();

    $reponse->assertJsonPath('data.items_count', 2)->assertJsonPath('data.outstanding.amount', 82000)->assertJsonPath('data.currency', 'EUR');
    $ligne = collect($reponse->json('data.items'))->firstWhere('type', 'invoice');

    expect($ligne)->toMatchArray(['type' => 'invoice', 'item_id' => $s['facture'], 'invoice_id' => $s['facture'], 'installment_id' => null, 'reference' => 'FA-2026-0001', 'period' => null, 'issued_on' => '2026-10-01', 'due_date' => '2026-10-15'])
        ->and($ligne['total']['amount'])->toBe(12000)
        ->and($ligne['amount_due_at_inclusion']['amount'])->toBe(12000)
        ->and($ligne['outstanding']['amount'])->toBe(12000)
        ->and(collect($reponse->json('data.items'))->firstWhere('type', 'installment')['reference'])->toBeNull()
        ->and(creancesRevendiquees($s['org']->id))->toBe(2);

    L::dans($s['org'], function () use ($s): void {
        $enregistree = RecoveryCaseItem::query()->where('item_id', $s['facture'])->firstOrFail();

        expect($enregistree->reference)->toBe('FA-2026-0001')->and($enregistree->amount_due->getAmount())->toBe('12000');
    });
});

it('ouvre un dossier de factures seules, et refuse une demande sans aucune créance', function (): void {
    $s = scenarioFacture($this);
    X::basculer($this, $s['org']);
    $corps = ['lease_id' => $s['bail']->id, 'debtor_party_id' => $s['locataire']->id];

    $this->postJson(X::url($s['org'], '/cases'), $corps)->assertUnprocessable()->assertJsonValidationErrors('installment_ids');
    $this->postJson(X::url($s['org'], '/cases'), [...$corps, 'installment_ids' => [], 'invoice_ids' => []])->assertUnprocessable();
    $this->postJson(X::url($s['org'], '/cases'), [...$corps, 'invoice_ids' => ['pas-un-uuid']])->assertUnprocessable();
    $this->postJson(X::url($s['org'], '/cases'), [...$corps, 'invoice_ids' => [$s['facture'], $s['facture']]])->assertUnprocessable();
    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(0);

    $this->postJson(X::url($s['org'], '/cases'), [...$corps, 'invoice_ids' => [$s['facture']]])->assertCreated()->assertJsonPath('data.outstanding.amount', 12000);
});

it('suit le grand livre pendant le dossier : règlement partiel, avoir puis règlement total', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$s['facture']])->assertCreated()->json('data.id');
    $dossier = fn () => $this->getJson(X::url($s['org'], "/cases/{$id}"))->assertOk();
    $facture = L::dans($s['org'], fn () => Invoice::query()->findOrFail($s['facture']));

    payerFacture($this, $s['org'], $s['facture'], 2000)->assertCreated();
    $dossier()->assertJsonPath('data.outstanding.amount', 10000)->assertJsonPath('data.items.0.outstanding.amount', 10000)->assertJsonPath('data.items.0.amount_due_at_inclusion.amount', 12000);

    $ligne = L::dans($s['org'], fn () => InvoiceLine::query()->where('invoice_id', $s['facture'])->firstOrFail()->id);
    $this->postJson(I::url($s['org'], "/{$s['facture']}/credit-notes"), ['reason' => 'Remise commerciale', 'full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 300]], 'idempotency_key' => 'avoir-recouvrement-1'])->assertCreated();
    $dossier()->assertJsonPath('data.outstanding.amount', 6400);

    expect(collect($this->getJson(X::url($s['org'], '/unpaid'))->assertOk()->json('data'))->firstWhere('item_id', $s['facture'])['outstanding']['amount'])->toBe(6400);
    payerFacture($this, $s['org'], $s['facture'], 6400)->assertCreated();
    $dossier()->assertJsonPath('data.outstanding.amount', 0)->assertJsonPath('data.items_count', 1);
    $this->postJson(X::url($s['org'], "/cases/{$id}/bundles"))->assertConflict()->assertJsonPath('code', 'recovery_nothing_due');
    expect(collect($this->getJson(X::url($s['org'], '/unpaid'))->assertOk()->json('data'))->pluck('item_id')->all())->not->toContain($s['facture']);
});

it('un avoir total pendant le dossier solde la créance : plus d\'envoi possible', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$s['facture']])->assertCreated()->json('data.id');

    $this->postJson(I::url($s['org'], "/{$s['facture']}/credit-notes"), ['reason' => 'Erreur de facturation', 'full' => true, 'idempotency_key' => 'avoir-total-recouvrement'])->assertCreated();

    $this->getJson(X::url($s['org'], "/cases/{$id}"))->assertOk()->assertJsonPath('data.outstanding.amount', 0);
    $this->postJson(X::url($s['org'], "/cases/{$id}/bundles"))->assertConflict()->assertJsonPath('code', 'recovery_nothing_due');
});

it('une facture ne figure que dans un seul dossier actif ; clôture et retrait la libèrent', function (): void {
    $s = scenarioFacture($this);
    $autre = L::partie($s['org']);
    LeasesReadContext::lier($s['org'], $s['bail'], $autre, ['valid_from' => '2026-01-01']);
    $premier = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$s['facture']])->assertCreated();

    X::ouvrir($this, $s['org'], $s['bail'], $autre, [], [$s['facture']])->assertConflict()->assertJsonPath('code', 'recovery_receivable_taken');
    $second = X::ouvrir($this, $s['org'], $s['bail'], $autre, [$s['ids'][0]])->assertCreated()->json('data.id');
    $this->postJson(X::url($s['org'], "/cases/{$second}/items"), ['invoice_ids' => [$s['facture']]])->assertConflict()->assertJsonPath('code', 'recovery_receivable_taken');
    $this->getJson(X::url($s['org'], '/unpaid'))->assertOk();
    expect(collect($this->getJson(X::url($s['org'], '/unpaid'))->json('data'))->firstWhere('item_id', $s['facture'])['case'])->toBe(['id' => $premier->json('data.id'), 'number' => $premier->json('data.number')]);
    expect(creancesRevendiquees($s['org']->id))->toBe(2);

    $ligne = $premier->json('data.items.0.id');
    $this->deleteJson(X::url($s['org'], "/cases/{$premier->json('data.id')}/items/{$ligne}"))->assertOk()->assertJsonPath('data.items_count', 0);
    expect(creancesRevendiquees($s['org']->id))->toBe(1);
    $this->postJson(X::url($s['org'], "/cases/{$second}/items"), ['invoice_ids' => [$s['facture']]])->assertOk()->assertJsonPath('data.items_count', 2);

    $this->postJson(X::url($s['org'], "/cases/{$second}/status"), ['status' => 'closed', 'reason' => 'Réglé'])->assertOk();
    expect(creancesRevendiquees($s['org']->id))->toBe(0);
    X::ouvrir($this, $s['org'], $s['bail'], $autre, [], [$s['facture']])->assertCreated();
});

it('la base refuse une seconde revendication de la même facture, même si le contrôle applicatif est contourné', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$s['facture']])->assertCreated()->json('data.id');

    expect(fn () => DB::table('recovery_item_claims')->insert(['organization_id' => $s['org']->id, 'item_type' => 'invoice', 'item_id' => $s['facture'], 'case_id' => $id, 'created_at' => now()->format('Y-m-d H:i:s.u')]))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('ajoute une facture à un dossier ouvert, rejouable, sans effacer', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]])->assertCreated()->json('data.id');
    $url = X::url($s['org'], "/cases/{$id}/items");

    $this->postJson($url, ['invoice_ids' => [$s['facture']]])->assertOk()->assertJsonPath('data.items_count', 2)->assertJsonPath('data.outstanding.amount', 82000);
    $this->postJson($url, ['invoice_ids' => [$s['facture']]])->assertOk()->assertJsonPath('data.items_count', 2);
    expect(L::dans($s['org'], fn () => RecoveryCaseItem::query()->count()))->toBe(2);
});

it('refuse une facture qui n\'est pas un impayé échu de ce bail', function (): void {
    $s = scenarioFacture($this);
    $future = X::facturer($this, $s['org'], $s['bail'], $s['locataire'], '2026-12-31');
    $soldee = X::facturer($this, $s['org'], $s['bail'], $s['locataire']);
    payerFacture($this, $s['org'], $soldee, 12000)->assertCreated();
    $sansBail = I::emettre($this, $s['org'], I::destinataire($s['org']));
    $brouillon = $this->postJson(I::url($s['org']), I::brouillon($s['locataire'], null, ['lease_id' => $s['bail']->id, 'due_on' => '2026-10-15']))->assertCreated()->json('data.id');
    $autreBail = X::impayes($this, $s['org']);
    $avoir = $this->postJson(I::url($s['org'], "/{$s['facture']}/credit-notes"), ['reason' => 'Motif', 'full' => false, 'lines' => [['line_id' => L::dans($s['org'], fn () => InvoiceLine::query()->where('invoice_id', $s['facture'])->firstOrFail()->id), 'quantity_milli' => 100]], 'idempotency_key' => 'avoir-id'])->assertCreated()->json('data.id');

    foreach ([$future, $soldee, $sansBail->id, $brouillon, $avoir, fake()->uuid()] as $id) {
        X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$id])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    }

    X::ouvrir($this, $s['org'], $autreBail['bail'], $autreBail['locataire'], [], [$s['facture']])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(0)->and(creancesRevendiquees($s['org']->id))->toBe(0);
});

it('refuse une facture adressée à une partie qui n\'est pas locataire du bail', function (): void {
    $s = X::impayes($this);
    $garant = L::partie($s['org']);
    LeasesReadContext::lier($s['org'], $s['bail'], $garant, ['role' => 'guarantor', 'valid_from' => '2026-01-01']);
    $facture = X::facturer($this, $s['org'], $s['bail'], $garant);

    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [], [$facture])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(0);
});

it('cloisonne par organisation : la facture d\'une autre agence est introuvable, invisible et intouchée', function (): void {
    $a = scenarioFacture($this);
    $b = X::impayes($this, nom: 'Agence voisine');
    $factureB = X::facturer($this, $b['org'], $b['bail'], $b['locataire']);
    X::basculer($this, $a['org']);

    X::ouvrir($this, $a['org'], $a['bail'], $a['locataire'], [], [$factureB])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    X::ouvrir($this, $a['org'], $b['bail'], $a['locataire'], [], [$factureB])->assertNotFound();
    expect(array_column($this->getJson(X::url($a['org'], '/unpaid'))->assertOk()->json('data'), 'item_id'))->not->toContain($factureB);

    $dossierB = X::ouvrir($this, $b['org'], $b['bail'], $b['locataire'], [], [$factureB])->assertCreated()->json('data.id');
    X::basculer($this, $a['org']);
    $this->getJson(X::url($a['org'], "/cases/{$dossierB}"))->assertNotFound();
    $this->postJson(X::url($a['org'], "/cases/{$dossierB}/items"), ['invoice_ids' => [$a['facture']]])->assertNotFound();
    expect(L::dans($a['org'], fn () => RecoveryCase::query()->count()))->toBe(0);
});

it('exige un jeton et un rôle d\'écriture pour inclure une facture', function (): void {
    $s = scenarioFacture($this);
    $corps = ['lease_id' => $s['bail']->id, 'debtor_party_id' => $s['locataire']->id, 'invoice_ids' => [$s['facture']]];

    auth()->forgetGuards();
    $this->postJson(X::url($s['org'], '/cases'), $corps)->assertUnauthorized();

    $comptable = L::membre($s['org'], MemberRole::Accountant);
    activerDeuxFacteurs($comptable);
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($comptable);

    $this->postJson(X::url($s['org'], '/cases'), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->getJson(X::url($s['org'], '/unpaid'))->assertOk()->assertJsonCount(4, 'data');
    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(0);
});

it('l\'envoi réunit la facture émise, la fige au décompte et la nomme dans le ZIP', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]], [$s['facture']])->assertCreated()->json('data.id');
    $facture = L::dans($s['org'], fn () => Invoice::query()->findOrFail($s['facture']));

    $reponse = $this->postJson(X::url($s['org'], "/cases/{$id}/bundles"))->assertCreated();
    $pieces = collect($reponse->json('data.pieces'));
    $lignes = collect($reponse->json('data.statement.lines'));

    $reponse->assertJsonPath('data.total_due.amount', 82000)->assertJsonPath('data.statement.totals.called', 82000);
    expect($pieces->pluck('kind')->all())->toBe(['statement', 'rent_notice', 'invoice', 'lease', 'ledger_extract'])
        ->and($pieces->firstWhere('kind', 'invoice'))->toMatchArray(['number' => 'FA-2026-0001', 'file_name' => 'facture-FA-2026-0001.pdf', 'sha256' => $facture->fingerprint, 'item_id' => $s['facture']])
        ->and($lignes->firstWhere('type', 'invoice'))->toMatchArray(['reference' => 'FA-2026-0001', 'issued_on' => '2026-10-01', 'period_start' => null, 'due_date' => '2026-10-15', 'total' => 12000, 'outstanding' => 12000])
        ->and($lignes->firstWhere('type', 'installment')['issued_on'])->toBeNull();

    L::dans($s['org'], function () use ($reponse, $facture): void {
        $envoi = RecoveryBundle::query()->findOrFail($reponse->json('data.id'));
        $fichier = StoredFile::query()->findOrFail($envoi->stored_file_id);
        $chemin = tempnam(sys_get_temp_dir(), 'zip');
        file_put_contents($chemin, Storage::disk($fichier->disk)->get($fichier->path));
        $zip = new ZipArchive;
        $zip->open($chemin);
        $noms = array_map(fn (int $i): string => (string) $zip->getNameIndex($i), range(0, $zip->numFiles - 1));
        $zip->close();
        unlink($chemin);

        expect($noms)->toHaveCount(5)->and(implode('|', $noms))->toContain('FA-2026-0001')
            ->and(IssuedDocument::query()->where('type', IssuedDocumentType::DebtStatement)->firstOrFail()->snapshot['lines'][1]['type'])->toBe('invoice')
            ->and($facture->stored_file_id)->not->toBeNull();
    });

    $demandes = Http::recorded(fn ($requete): bool => str_contains($requete->body(), 'Décompte des sommes dues'));
    expect($demandes)->toHaveCount(1)
        ->and($demandes->first()[0]->body())->toContain('Facture FA-2026-0001 du 01/10/2026')->toContain('Loyer du');
});

it('l\'envoi suit le grand livre : la facture réglée après un premier envoi apparaît à zéro dans le second', function (): void {
    $s = scenarioFacture($this);
    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]], [$s['facture']])->assertCreated()->json('data.id');
    $premier = $this->postJson(X::url($s['org'], "/cases/{$id}/bundles"))->assertCreated();
    payerFacture($this, $s['org'], $s['facture'], 12000)->assertCreated();

    $second = $this->postJson(X::url($s['org'], "/cases/{$id}/bundles"))->assertCreated();

    expect($premier->json('data.total_due.amount'))->toBe(82000)
        ->and($this->getJson(X::url($s['org'], '/bundles/'.$premier->json('data.id')))->json('data.statement.totals.outstanding'))->toBe(82000)
        ->and($second->json('data.total_due.amount'))->toBe(70000)
        ->and(collect($second->json('data.statement.lines'))->firstWhere('type', 'invoice')['outstanding'])->toBe(0);
});
