<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Charges\Models\Expense;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Money\Currency;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

it('un bailleur autonome enregistre une dépense réglée par banque : écriture équilibrée et montants en unités mineures', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    $id = C::depense($this, $scene)->assertCreated()
        ->assertJsonPath('data.status', 'recorded')
        ->assertJsonPath('data.total_gross.amount', 24000)
        ->assertJsonPath('data.total_gross.currency', 'EUR')
        ->assertJsonPath('data.recoverable_amount.amount', 12000)
        ->assertJsonPath('data.posted', true)
        ->json('data.id');

    expect(C::net($scene['org'], AccountRole::Expenses))->toBe(24000)
        ->and(C::net($scene['org'], AccountRole::Bank))->toBe(-24000);

    $totaux = L::dans($scene['org'], fn () => app(LedgerAggregates::class)->itemTotals(ItemType::Expense, new Currency('EUR'), CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2027-01-01')));
    expect($totaux[$id]->getAmount())->toBe('24000');
});

it('une dépense réglée en espèces sort de la caisse', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, ['settlement' => 'cash'])->assertCreated();

    expect(C::net($scene['org'], AccountRole::Cash))->toBe(-24000);
});

it('rejoue la même clé et le même contenu sans seconde écriture, refuse un autre contenu sous la même clé', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $corps = ['reference' => 'F-REJEU'];

    $premier = C::depense($this, $scene, $corps, 'cle-rejeu-0001')->assertCreated()->json('data.id');
    C::depense($this, $scene, $corps, 'cle-rejeu-0001')->assertOk()->assertJsonPath('data.id', $premier);
    C::depense($this, $scene, [...$corps, 'total_gross' => 25000], 'cle-rejeu-0001')->assertStatus(409)->assertJsonPath('code', 'charges_idempotency_key_reused');

    expect(L::dans($scene['org'], fn () => Expense::query()->count()))->toBe(1)
        ->and(C::net($scene['org'], AccountRole::Expenses))->toBe(24000);
});

it('refuse un doublon sous une autre clé', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $corps = ['reference' => 'F-DOUBLON'];

    C::depense($this, $scene, $corps)->assertCreated();
    C::depense($this, $scene, $corps)->assertStatus(409)->assertJsonPath('code', 'expense_duplicate');

    expect(C::net($scene['org'], AccountRole::Expenses))->toBe(24000);
});

it('annule une dépense par contrepassation, puis permet de la ressaisir', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $corps = ['reference' => 'F-ANNUL'];
    $id = C::depense($this, $scene, $corps)->assertCreated()->json('data.id');

    $this->postJson(C::url($scene['org'], "/expenses/{$id}/cancel"), ['reason' => 'Saisie en double'])->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->postJson(C::url($scene['org'], "/expenses/{$id}/cancel"), ['reason' => 'Saisie en double'])->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(C::net($scene['org'], AccountRole::Expenses))->toBe(0)->and(C::net($scene['org'], AccountRole::Bank))->toBe(0);

    C::depense($this, $scene, $corps)->assertCreated();
    expect(C::net($scene['org'], AccountRole::Expenses))->toBe(24000);
});

it('une dépense payée par le mandant ou un relevé du syndic n\'écrit rien au grand livre', function (): void {
    $scene = C::agence();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null, 'category_term_id' => C::categorie('property_tax')])
        ->assertCreated()->assertJsonPath('data.posted', false);
    C::depense($this, $scene, ['kind' => 'co_ownership_statement', 'settlement' => 'none', 'category_term_id' => C::categorie('co_ownership'), 'recoverable_rubric' => 'building_equipment', 'paid_on' => null])
        ->assertCreated()->assertJsonPath('data.posted', false);

    expect(C::net($scene['org'], AccountRole::OwnerPayable))->toBe(0)->and(C::net($scene['org'], AccountRole::Expenses))->toBe(0);
});

it('refuse les dépenses incohérentes', function (array $corps, int $statut, string $code): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, $corps)->assertStatus($statut)->assertJsonPath('code', $code);
})->with([
    'part récupérable au-delà du total' => [['recoverable_amount' => 30000], 422, 'expense_invalid'],
    'rubrique inconnue' => [['recoverable_rubric' => 'inventee'], 422, 'expense_invalid'],
    'service inversé' => [['service_from' => '2027-01-01', 'service_to' => '2026-01-01'], 422, 'validation_failed'],
    'paiement avant la pièce' => [['paid_on' => '2026-03-01'], 422, 'expense_invalid'],
    'devise envoyée par le client' => [['currency' => 'XOF'], 422, 'validation_failed'],
    'mandant envoyé par le client' => [['mandant_party_id' => '0197f0a0-0000-7000-8000-000000000000'], 422, 'validation_failed'],
    'statut envoyé par le client' => [['status' => 'recorded'], 422, 'validation_failed'],
    'sans bénéficiaire' => [['payee_label' => null], 422, 'expense_invalid'],
]);

it('exige une pièce pour une part récupérable', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, [], null, false)->assertStatus(422)->assertJsonPath('code', 'expense_invalid');
});

it('une catégorie non récupérable ou un appel de fonds refusent toute part récupérable', function (string $categorie): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, ['category_term_id' => C::categorie($categorie)])->assertStatus(422)->assertJsonPath('code', 'expense_invalid');
})->with(['management_fees', 'insurance', 'loan_interest', 'improvements', 'co_ownership']);

it('un lot d\'un autre bien est refusé et un bien inconnu est introuvable', function (): void {
    $scene = C::autonome();
    $autre = C::agence();
    C::comme($this, $scene['owner']);

    C::depense($this, $scene, ['unit_id' => $autre['unit']->id])->assertStatus(422)->assertJsonPath('code', 'expense_invalid');
    C::depense($this, $scene, ['property_id' => '0197f0a0-0000-7000-8000-000000000000', 'unit_id' => null])->assertNotFound();
});

it('ajoute puis télécharge une pièce, et refuse un contenu qui n\'est pas une pièce', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $id = C::depense($this, $scene)->assertCreated()->json('data.id');

    $fichier = $this->post(C::url($scene['org'], "/expenses/{$id}/files"), ['file' => DocumentsContext::pdf('avis.pdf')], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    $this->get(C::url($scene['org'], "/expenses/{$id}/files/{$fichier}"))->assertOk();
    $this->getJson(C::url($scene['org'], "/expenses/{$id}"))->assertOk()->assertJsonCount(2, 'data.files');

    $faux = UploadedFile::fake()->createWithContent('malin.pdf', '<?php system($_GET["c"]);');
    $this->post(C::url($scene['org'], "/expenses/{$id}/files"), ['file' => $faux], ['Accept' => 'application/json'])->assertStatus(422);
});

it('liste les dépenses par curseur et filtre sur le statut', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    C::depense($this, $scene, ['reference' => 'A1'])->assertCreated();
    $b = C::depense($this, $scene, ['reference' => 'A2'])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/expenses/{$b}/cancel"), ['reason' => 'Erreur de saisie'])->assertOk();

    $this->getJson(C::url($scene['org'], '/expenses?per_page=1'))->assertOk()->assertJsonCount(1, 'data')->assertJsonStructure(['data', 'links', 'meta']);
    $this->getJson(C::url($scene['org'], '/expenses?status=cancelled'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b);
});

it('refuse en base la modification et la suppression d\'une dépense', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $id = C::depense($this, $scene)->assertCreated()->json('data.id');

    expect(fn () => DB::table('expenses')->where('id', $id)->update(['total_gross' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('expenses')->where('id', $id)->update(['unit_id' => null]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('expenses')->where('id', $id)->delete())->toThrow(QueryException::class);
});

it('journalise la saisie sans montant ni libellé', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $id = C::depense($this, $scene, ['payee_label' => 'Ascenseurs Dupont'])->assertCreated()->json('data.id');

    $lignes = DB::table('audit_logs')->where('subject_id', $id)->get();
    $texte = (string) json_encode($lignes);

    expect($lignes->pluck('action')->all())->toContain('charges.expense.recorded')
        ->and($texte)->not->toContain('24000')->and($texte)->not->toContain('Dupont');
});

it('une période close reporte l\'écriture au premier jour ouvert', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    C::depense($this, $scene, ['reference' => 'F-OUVERT', 'document_on' => '2026-01-10', 'paid_on' => '2026-01-10'])->assertCreated();
    L::dans($scene['org'], fn () => app(Ledger::class)->closeMonth(CarbonImmutable::parse('2026-01-01'), null, fn (): array => [], CarbonImmutable::parse('2026-11-16')));

    C::depense($this, $scene, ['reference' => 'F-CLOS', 'document_on' => '2026-01-20', 'paid_on' => '2026-01-20'])->assertCreated();

    $date = L::dans($scene['org'], fn () => DB::table('journal_entries')->where('source_type', 'expense')->orderByDesc('number')->value('entry_date'));
    expect($date)->toBeGreaterThan('2026-01-31');
});

function violationUnique(string $colonne): UniqueConstraintViolationException
{
    return new UniqueConstraintViolationException('sqlite', 'insert into expenses', [], new Exception("UNIQUE constraint failed: expenses.organization_id, expenses.{$colonne}"));
}

it('ne traduit en dépense déjà enregistrée que la violation d\'unicité de l\'empreinte', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $evenement = 'eloquent.creating: '.Expense::class;

    Event::listen($evenement, fn () => throw violationUnique('active_fingerprint'));
    C::depense($this, $scene)->assertStatus(409)->assertJsonPath('code', 'expense_duplicate');
    Event::forget($evenement);

    Event::listen($evenement, fn () => throw violationUnique('autre_colonne'));
    expect(C::depense($this, $scene)->assertStatus(500)->json('code'))->not->toBe('expense_duplicate');
    Event::forget($evenement);
});
