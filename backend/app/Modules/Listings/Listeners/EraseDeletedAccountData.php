<?php

declare(strict_types=1);

namespace App\Modules\Listings\Listeners;

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Listings\Models\ListingFavorite;
use Illuminate\Support\Facades\DB;

/**
 * Le compte est marqué supprimé : ses favoris n'ont plus d'objet, et le texte libre de ses demandes de visite s'efface.
 */
final class EraseDeletedAccountData
{
    public function handle(AccountDeleted $evenement): void
    {
        DB::transaction(function () use ($evenement): void {
            ListingFavorite::query()->where('user_id', $evenement->userId)->delete();
            DB::table('listing_leads')->where('user_id', $evenement->userId)->update(['requested_slot' => '', 'message' => null]);
        });
    }
}
