<?php

namespace App\Services\Concerns;

use Carbon\Carbon;

trait BuildsHistory
{
    /**
     * A statusHistory / audit entry: { at, by, action, note? } with an ISO-8601
     * UTC `at` timestamp (file 01 §7). `by` (the actor) is always derived from the
     * caller's bearer token — never the client.
     */
    protected function historyEntry(string $actor, string $action, ?string $note = null): array
    {
        $entry = [
            'at' => Carbon::now('UTC')->format('Y-m-d\TH:i:s.v\Z'),
            'by' => $actor,
            'action' => $action,
        ];
        if ($note !== null && $note !== '') {
            $entry['note'] = $note;
        }

        return $entry;
    }

    protected function appendHistory($model, string $actor, string $action, ?string $note = null): void
    {
        $history = $model->statusHistory ?? [];
        $history[] = $this->historyEntry($actor, $action, $note);
        $model->statusHistory = $history;
    }

    protected function nowIso(): string
    {
        return Carbon::now('UTC')->format('Y-m-d\TH:i:s.v\Z');
    }
}
