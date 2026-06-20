<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function index()
    {
        return $this->ok(Lead::orderByDesc('createdAt')->get());
    }

    public function show($id)
    {
        return $this->ok(Lead::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $lead = Lead::findOrFail($id);
        $data = $request->validate([
            'status' => ['sometimes', 'string', 'max:20'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $lead->fill($data);
        $lead->updatedAt = Carbon::now('UTC');
        $lead->save();

        return $this->ok($lead);
    }

    public function destroy($id)
    {
        $lead = Lead::find($id);
        if (! $lead) {
            return $this->fail('Not found', 404);
        }
        $lead->delete();

        return $this->ok(['success' => true]);
    }
}
