<?php

declare(strict_types=1);

use App\Modules\Catalog\Actions\ArchiveCustomField;
use App\Modules\Catalog\Actions\ArchiveTerm;
use App\Modules\Catalog\Actions\CreateTerm;
use App\Modules\Catalog\Data\NewTermData;
use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use Illuminate\Validation\ValidationException;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->validateur = app(CustomFieldValidator::class);
});

function catalogueDefinir(object $org, string $cle, CustomFieldType $type, array $attributs = []): CustomFieldDefinition
{
    return C::dans($org, fn (): CustomFieldDefinition => CustomFieldDefinition::factory()->create([
        'entity' => CustomFieldEntity::Unit, 'key' => $cle, 'type' => $type, ...$attributs,
    ]));
}

/**
 * @return array<string, list<string>>
 */
function catalogueErreurs(object $org, array $valeurs, array $courantes = []): array
{
    try {
        C::dans($org, fn () => app(CustomFieldValidator::class)->validate(CustomFieldEntity::Unit, $valeurs, $courantes));
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('accepte et normalise une valeur valide de chaque type', function (): void {
    catalogueDefinir($this->org, 'texte', CustomFieldType::Text);
    catalogueDefinir($this->org, 'surface', CustomFieldType::Number);
    catalogueDefinir($this->org, 'loyer', CustomFieldType::Money);
    catalogueDefinir($this->org, 'echeance', CustomFieldType::Date);
    catalogueDefinir($this->org, 'alarme', CustomFieldType::Bool);
    catalogueDefinir($this->org, 'vue', CustomFieldType::Select, ['options' => [['key' => 'mer', 'labels' => ['fr' => 'Mer']], ['key' => 'parc', 'labels' => ['fr' => 'Parc']]]]);
    catalogueDefinir($this->org, 'vues', CustomFieldType::Multiselect, ['options' => [['key' => 'mer', 'labels' => ['fr' => 'Mer']], ['key' => 'parc', 'labels' => ['fr' => 'Parc']]]]);
    catalogueDefinir($this->org, 'site', CustomFieldType::Url);
    $type = Term::query()->where('key', 'apartment')->firstOrFail();
    catalogueDefinir($this->org, 'categorie', CustomFieldType::Term, ['vocabulary' => 'unit_type']);

    $valeurs = [
        'texte' => 'Code 1234', 'surface' => 42.5, 'loyer' => ['amount' => 85000, 'currency' => 'XOF'], 'echeance' => '2026-12-31',
        'alarme' => false, 'vue' => 'mer', 'vues' => ['mer', 'parc'], 'site' => 'https://exemple.fr/plan?x=1', 'categorie' => $type->id,
    ];

    $resultat = C::dans($this->org, fn (): array => $this->validateur->validate(CustomFieldEntity::Unit, $valeurs));

    expect($resultat)->toEqualCanonicalizing($valeurs);
});

it('refuse les valeurs du mauvais type, par champ', function (string $type, mixed $valeur): void {
    catalogueDefinir($this->org, 'champ', CustomFieldType::from($type), $type === 'select'
        ? ['options' => [['key' => 'mer', 'labels' => ['fr' => 'Mer']]]]
        : ($type === 'term' ? ['vocabulary' => 'unit_type'] : []));

    expect(catalogueErreurs($this->org, ['champ' => $valeur]))->toHaveKey('custom_fields.champ');
})->with([
    'texte non chaîne' => ['text', 12],
    'texte trop long' => ['text', str_repeat('a', 2001)],
    'nombre en chaîne' => ['number', '12'],
    'montant décimal' => ['money', ['amount' => 12.5, 'currency' => 'EUR']],
    'montant devise inconnue' => ['money', ['amount' => 100, 'currency' => 'ZZZ']],
    'montant devise minuscule' => ['money', ['amount' => 100, 'currency' => 'eur']],
    'montant clé en trop' => ['money', ['amount' => 100, 'currency' => 'EUR', 'x' => 1]],
    'montant nu' => ['money', 100],
    'date impossible' => ['date', '2026-02-30'],
    'date mal formée' => ['date', '31/12/2026'],
    'booléen en chaîne' => ['bool', 'true'],
    'choix hors options' => ['select', 'montagne'],
    'choix non chaîne' => ['select', ['mer']],
    'terme inexistant' => ['term', '01934f6e-0000-7000-8000-00000000dead'],
    'terme non identifiant' => ['term', 'apartment'],
    'url javascript' => ['url', 'javascript:alert(1)'],
    'url sans hôte' => ['url', 'https://'],
    'url relative' => ['url', '/plan'],
]);

it('refuse un choix multiple hors options ou en double', function (): void {
    catalogueDefinir($this->org, 'vues', CustomFieldType::Multiselect, ['options' => [['key' => 'mer', 'labels' => ['fr' => 'Mer']]]]);

    expect(catalogueErreurs($this->org, ['vues' => ['mer', 'parc']]))->toHaveKey('custom_fields.vues')
        ->and(catalogueErreurs($this->org, ['vues' => ['mer', 'mer']]))->toHaveKey('custom_fields.vues')
        ->and(catalogueErreurs($this->org, ['vues' => 'mer']))->toHaveKey('custom_fields.vues')
        ->and(catalogueErreurs($this->org, ['vues' => ['mer']]))->toBe([]);
});

it('exige les champs obligatoires et retire les valeurs vides', function (): void {
    catalogueDefinir($this->org, 'code', CustomFieldType::Text, ['required' => true]);
    catalogueDefinir($this->org, 'note', CustomFieldType::Text);

    expect(catalogueErreurs($this->org, []))->toHaveKey('custom_fields.code')
        ->and(catalogueErreurs($this->org, ['code' => '']))->toHaveKey('custom_fields.code')
        ->and(catalogueErreurs($this->org, ['code' => null]))->toHaveKey('custom_fields.code');

    $resultat = C::dans($this->org, fn (): array => $this->validateur->validate(CustomFieldEntity::Unit, ['code' => 'A1', 'note' => '']));

    expect($resultat)->toBe(['code' => 'A1']);
});

it('refuse une clé inconnue, d\'un autre objet, d\'un champ archivé ou d\'une autre organisation', function (): void {
    catalogueDefinir($this->org, 'ancien', CustomFieldType::Text);
    C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Lease, 'key' => 'pour_bail']));
    $autre = C::organisation();
    catalogueDefinir($autre, 'chez_autre', CustomFieldType::Text);
    C::dans($this->org, fn () => app(ArchiveCustomField::class)->handle(CustomFieldDefinition::query()->where('key', 'ancien')->firstOrFail(), true));

    $erreurs = catalogueErreurs($this->org, ['inconnu' => 'x', 'pour_bail' => 'x', 'chez_autre' => 'x', 'ancien' => 'x']);

    expect(array_keys($erreurs))->toBe(['custom_fields.inconnu', 'custom_fields.pour_bail', 'custom_fields.chez_autre', 'custom_fields.ancien']);
});

it('conserve les valeurs d\'un champ archivé et remplace celles des champs actifs', function (): void {
    catalogueDefinir($this->org, 'actif', CustomFieldType::Text);
    $ancien = catalogueDefinir($this->org, 'ancien', CustomFieldType::Text);
    C::dans($this->org, fn () => app(ArchiveCustomField::class)->handle($ancien, true));

    $resultat = C::dans($this->org, fn (): array => $this->validateur->validate(
        CustomFieldEntity::Unit,
        ['actif' => 'nouveau'],
        ['actif' => 'ancien', 'ancien' => 'a conserver', 'orphelin' => 1],
    ));

    expect($resultat)->toBe(['ancien' => 'a conserver', 'orphelin' => 1, 'actif' => 'nouveau']);
});

it('refuse une valeur de référentiel d\'une autre organisation, archivée ou d\'un autre référentiel', function (): void {
    catalogueDefinir($this->org, 'categorie', CustomFieldType::Term, ['vocabulary' => 'expense_category']);
    $creer = fn (object $org, string $cle): string => C::dans($org, fn (): string => app(CreateTerm::class)->handle(
        VocabularyKey::ExpenseCategory, new NewTermData($cle, ['fr' => $cle], 'expense.other', null, []),
    )->id);

    $propre = $creer($this->org, 'propre');
    $etranger = $creer(C::organisation(), 'etranger');
    $autreVocabulaire = Term::query()->where('key', 'apartment')->firstOrFail()->id;

    expect(catalogueErreurs($this->org, ['categorie' => $propre]))->toBe([])
        ->and(catalogueErreurs($this->org, ['categorie' => $etranger]))->toHaveKey('custom_fields.categorie')
        ->and(catalogueErreurs($this->org, ['categorie' => $autreVocabulaire]))->toHaveKey('custom_fields.categorie');

    C::dans($this->org, fn () => app(ArchiveTerm::class)->handle(Term::query()->findOrFail($propre), true));

    expect(catalogueErreurs($this->org, ['categorie' => $propre]))->toHaveKey('custom_fields.categorie')
        ->and(catalogueErreurs($this->org, ['categorie' => $propre], ['categorie' => $propre]))->toBe([]);
});

it('signale qu\'une valeur existe : le type du champ se fige une seule fois', function (): void {
    $champ = catalogueDefinir($this->org, 'code', CustomFieldType::Text);
    catalogueDefinir($this->org, 'autre', CustomFieldType::Text);

    C::dans($this->org, fn () => $this->validateur->recordUsage(CustomFieldEntity::Unit, ['code' => 'A1']));
    $premier = $champ->refresh()->values_recorded_at;

    C::dans($this->org, fn () => $this->validateur->recordUsage(CustomFieldEntity::Unit, ['code' => 'A2']));

    expect($premier)->not->toBeNull()
        ->and($champ->refresh()->values_recorded_at?->equalTo($premier))->toBeTrue()
        ->and(C::dans($this->org, fn () => CustomFieldDefinition::query()->where('key', 'autre')->firstOrFail()->values_recorded_at))->toBeNull();
});
