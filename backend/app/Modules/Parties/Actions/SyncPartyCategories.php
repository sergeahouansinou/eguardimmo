<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyContactCategory;
use Illuminate\Support\Facades\DB;

final readonly class SyncPartyCategories
{
    public function __construct(private TermDirectory $termes) {}

    /**
     * Une catégorie archivée ou masquée déjà posée reste ; seules les nouvelles affectations sont contrôlées.
     *
     * @param  list<string>  $termIds
     */
    public function handle(Party $party, array $termIds): void
    {
        $voulues = array_values(array_unique($termIds));

        DB::transaction(function () use ($party, $voulues): void {
            $actuelles = PartyContactCategory::query()->where('party_id', $party->id)->get();

            foreach ($voulues as $id) {
                if (! $actuelles->contains('contact_category_term_id', $id)) {
                    $this->termes->findAssignable($id, VocabularyKey::ContactCategory);
                    PartyContactCategory::query()->create(['party_id' => $party->id, 'contact_category_term_id' => $id]);
                }
            }

            foreach ($actuelles as $ligne) {
                if (! in_array($ligne->contact_category_term_id, $voulues, true)) {
                    $ligne->delete();
                }
            }
        });
    }
}
